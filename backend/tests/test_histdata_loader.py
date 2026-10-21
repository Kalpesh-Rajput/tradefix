"""HistData folder discovery, instrument catalog, spike rule, and period coverage. No network."""

from __future__ import annotations

import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pytest

from app.services.marketdata.candles import MINUTE_MS, Candles
from app.services.marketdata.coverage import covered_ranges
from app.services.marketdata.histdata_catalog import entry_for, to_spec
from app.services.marketdata.histdata_loader import find_archives, parse_archive
from app.services.marketdata.importer import import_candles
from app.services.marketdata.registry import get_instrument, mirror_to_db
from app.services.marketdata.store import LocalParquetStore
from app.services.marketdata.validation import clamp_wicks, off_level_mask, spike_mask, validate_batch
from tests.bt_support import db, requires_db

EST = timezone(timedelta(hours=-5))


def _ms(*args) -> int:
    return int(datetime(*args, tzinfo=timezone.utc).timestamp() * 1000)


@pytest.mark.parametrize(
    "name, year, month",
    [
        ("HISTDATA_COM_ASCII_EURUSD_M12000.zip", 2000, None),
        ("HISTDATA_COM_ASCII_EURUSD_M120261.zip", 2026, 1),
        ("HISTDATA_COM_ASCII_EURUSD_M1202610.zip", 2026, 10),
        ("HISTDATA_COM_ASCII_EURUSD_M1202604.zip", 2026, 4),
    ],
)
def test_archive_period_is_read_from_the_name(name, year, month):
    archive = parse_archive(Path(name))
    assert archive is not None and (archive.year, archive.month) == (year, month)


def test_unrecognised_archive_names_are_rejected():
    assert parse_archive(Path("notes.zip")) is None
    assert parse_archive(Path("HISTDATA_COM_ASCII_EURUSD_M1202613.zip")) is None


def test_period_bounds_follow_the_fixed_utc_minus_five_clock():
    annual = parse_archive(Path("x_M12019.zip")).bounds_ms()
    assert annual == (_ms(2019, 1, 1, 5), _ms(2020, 1, 1, 5))
    december = parse_archive(Path("x_M1201912.zip")).bounds_ms()
    assert december == (_ms(2019, 12, 1, 5), _ms(2020, 1, 1, 5))
    june = parse_archive(Path("x_M120196.zip")).bounds_ms()
    assert june == (_ms(2019, 6, 1, 5), _ms(2019, 7, 1, 5))


def test_catalog_classifies_every_kind_of_folder():
    assert entry_for("USDJPY").pip_size == 0.01 and entry_for("USDJPY").price_decimals == 3
    assert entry_for("EURUSD").pip_size == 0.0001 and entry_for("EURUSD").contract_size == 100_000
    assert (entry_for("XAUEUR").asset_class, entry_for("XAUEUR").contract_size) == ("metal", 100.0)
    assert entry_for("XAGUSD").contract_size == 5000.0
    assert entry_for("SPXUSD").symbol == "US500"
    assert entry_for("GRXEUR").symbol == "DE40"
    assert entry_for("WTIUSD").asset_class == "commodity"
    assert entry_for("not-a-symbol") is None
    spec = to_spec(entry_for("UKXGBP"))
    assert spec.symbol == "UK100" and not spec.enabled and spec.source == "dukascopy"


def test_find_archives_groups_folders_and_reports_skips(tmp_path: Path):
    (tmp_path / "EURUSD").mkdir()
    (tmp_path / "EURUSD" / "HISTDATA_COM_ASCII_EURUSD_M12001.zip").write_bytes(b"x")
    (tmp_path / "EURUSD" / "HISTDATA_COM_ASCII_EURUSD_M12000.zip").write_bytes(b"x")
    (tmp_path / "EURUSD" / "readme.zip").write_bytes(b"x")
    (tmp_path / "junk-folder").mkdir()
    found, skipped = find_archives(tmp_path)
    assert [a.year for a in found["EURUSD"]] == [2000, 2001]
    assert any("readme.zip" in note for note in skipped) and any("junk-folder" in note for note in skipped)
    only, _ = find_archives(tmp_path, ["US500"])
    assert only == {}


def _batch(closes: list[float]) -> Candles:
    rows = [(i * MINUTE_MS, c, c, c, c, 0.0) for i, c in enumerate(closes)]
    return Candles.from_rows(rows)


def test_single_corrupt_print_is_dropped_but_a_persistent_jump_is_kept():
    spike = _batch([1.12, 1.12, 1965.0, 1.12, 1.12])
    assert spike_mask(spike).tolist() == [False, False, True, False, False]
    clean, report = validate_batch(spike)
    assert report.rejected == {"spike": 1} and len(clean) == 4 and float(clean.high.max()) < 2
    jump = _batch([0.99, 0.99, 0.80, 0.80, 0.80])
    assert not spike_mask(jump).any()


def test_corrupt_wick_is_pulled_to_the_body_but_a_real_crash_wick_is_kept():
    rows = [
        (0, 1.10, 1.101, 1.099, 1.10, 0.0),
        (MINUTE_MS, 1.10, 220.0, 1.099, 1.10, 0.0),
        (2 * MINUTE_MS, 1.10, 1.101, 1.099, 1.10, 0.0),
    ]
    repaired, count = clamp_wicks(Candles.from_rows(rows))
    assert count == 1 and float(repaired.high[1]) == 1.10 and float(repaired.low[1]) == 1.099
    crash = [
        (0, 1.20, 1.20, 1.19, 1.19, 0.0),
        (MINUTE_MS, 1.19, 1.19, 0.87, 0.95, 0.0),
        (2 * MINUTE_MS, 0.95, 1.00, 0.94, 0.99, 0.0),
    ]
    kept, count = clamp_wicks(Candles.from_rows(crash))
    assert count == 0 and float(kept.low[1]) == 0.87


def test_quotes_from_another_price_level_are_dropped_only_when_repairing():
    closes = [86.0 + (i % 3) * 0.01 for i in range(150)]
    for i in (70, 71, 72):
        closes[i] = 1.2465
    batch = _batch(closes)
    assert off_level_mask(batch)[70:73].all() and off_level_mask(batch).sum() == 3
    repaired, report = validate_batch(batch, repair=True)
    assert report.rejected == {"off_level": 3} and len(repaired) == 147
    kept, report = validate_batch(batch, repair=True, level_filter=False)
    assert "off_level" not in report.rejected
    untouched, report = validate_batch(batch)
    assert "off_level" not in report.rejected


def test_a_real_gap_that_persists_is_not_off_level():
    closes = [1.20] * 80 + [0.85, 0.95] + [0.98] * 80
    assert not off_level_mask(_batch(closes)).any()


def test_short_batches_are_never_flagged():
    assert not spike_mask(_batch([1.0, 50.0])).any()
    assert not spike_mask(_batch([])).any()


@requires_db
def test_period_coverage_reaches_past_the_first_and_last_bar(db, tmp_path: Path):
    mirror_to_db(db)
    spec = get_instrument("US30")
    store = LocalParquetStore(tmp_path)
    archive = tmp_path / "eur.zip"
    with zipfile.ZipFile(archive, "w") as handle:
        handle.writestr("DAT_ASCII_EURUSD_M1_202401.csv", "20240102 100000;1.1;1.1;1.1;1.1;0\n20240102 100100;1.1;1.1;1.1;1.1;0\n")
    start, end = _ms(2024, 1, 1, 5), _ms(2024, 2, 1, 5)
    summary = import_candles(
        db, spec, archive, preset="histdata", label="HistData.com M1 ASCII", price_side="bid", store=store, coverage=(start, end)
    )
    assert summary.rows_kept == 2
    assert covered_ranges(db, "US30", "dukascopy")[0] == (start, end)
    assert np.all(store.read("dukascopy", "US30", start, end).ts % MINUTE_MS == 0)
