"""Coverage math and record_fetch ordering (backtesting 1D)."""

from __future__ import annotations

from datetime import datetime, timezone

import numpy as np
import pytest

from app.models.market_data import CandleCoverage, CandleMonthStat
from app.services.marketdata.candles import MINUTE_MS, Candles
from app.services.marketdata.coverage import (
    align_range,
    covered_ranges,
    find_gaps,
    mark_covered,
    merge_ranges,
    record_fetch,
    reset_coverage,
    subtract_ranges,
)
from app.services.marketdata.registry import get_instrument, mirror_to_db
from app.services.marketdata.store import LocalParquetStore
from tests.bt_support import db, requires_db  # noqa: F401

H = 3_600_000
T0 = int(datetime(2026, 2, 3, tzinfo=timezone.utc).timestamp() * 1000)


def test_merge_ranges_merges_overlap_and_adjacency():
    assert merge_ranges([(5, 10), (0, 3), (3, 4), (9, 12), (20, 20)]) == [(0, 4), (5, 12)]
    assert merge_ranges([]) == []


def test_subtract_ranges_returns_gaps():
    assert subtract_ranges((0, 100), []) == [(0, 100)]
    assert subtract_ranges((0, 100), [(0, 100)]) == []
    assert subtract_ranges((0, 100), [(10, 20), (15, 30), (50, 60), (90, 200)]) == [(0, 10), (30, 50), (60, 90)]
    assert subtract_ranges((40, 45), [(10, 20), (50, 60)]) == [(40, 45)]


def test_align_range_widens_to_minutes():
    assert align_range(MINUTE_MS + 5, 3 * MINUTE_MS - 1) == (MINUTE_MS, 3 * MINUTE_MS)
    assert align_range(MINUTE_MS, 2 * MINUTE_MS) == (MINUTE_MS, 2 * MINUTE_MS)


def _batch(start: int, minutes: int, skip: tuple[int, ...] = ()) -> Candles:
    ts = np.array([start + i * MINUTE_MS for i in range(minutes) if i not in skip], dtype=np.int64)
    n = ts.size
    return Candles.from_columns({"ts": ts, "open": [1.0] * n, "high": [1.1] * n, "low": [0.9] * n, "close": [1.05] * n, "volume": [2.0] * n})


@pytest.fixture()
def ctx(db, tmp_path):  # noqa: F811
    mirror_to_db(db)
    reset_coverage(db, "BTCUSDT")
    return db, LocalParquetStore(tmp_path), get_instrument("BTCUSDT")


@requires_db
def test_record_fetch_marks_coverage_after_write(ctx):
    db, store, spec = ctx
    assert find_gaps(db, "BTCUSDT", "binance", T0, T0 + 2 * H) == [(T0, T0 + 2 * H)]
    result = record_fetch(db, store, spec, T0, T0 + H, _batch(T0, 60, skip=(7, 8)))
    assert result.rows_kept == 58
    assert covered_ranges(db, "BTCUSDT", "binance") == [(T0, T0 + H)]
    assert find_gaps(db, "BTCUSDT", "binance", T0, T0 + 2 * H) == [(T0 + H, T0 + 2 * H)]
    record_fetch(db, store, spec, T0 + H, T0 + 2 * H, _batch(T0 + H, 60))
    rows = db.query(CandleCoverage).filter_by(instrument="BTCUSDT", source="binance").all()
    assert [(r.covered_from, r.covered_to, r.row_count) for r in rows] == [(T0, T0 + 2 * H, 118)]
    stat = db.query(CandleMonthStat).filter_by(instrument="BTCUSDT", source="binance", year=2026, month=2).one()
    assert stat.row_count == 118 and stat.gap_minutes == 2
    assert stat.detail["gap_ranges"] == [[T0 + 7 * MINUTE_MS, T0 + 9 * MINUTE_MS]]


@requires_db
def test_record_fetch_drops_rows_outside_requested_range(ctx):
    db, store, spec = ctx
    record_fetch(db, store, spec, T0, T0 + 10 * MINUTE_MS, _batch(T0 - 5 * MINUTE_MS, 30))
    assert store.count("binance", "BTCUSDT", T0 - H, T0 + H) == 10
    assert covered_ranges(db, "BTCUSDT", "binance") == [(T0, T0 + 10 * MINUTE_MS)]


@requires_db
def test_store_failure_leaves_coverage_unchanged(ctx, monkeypatch):
    db, store, spec = ctx
    record_fetch(db, store, spec, T0, T0 + H, _batch(T0, 60))

    def broken(*_a, **_k):
        raise OSError("disk full")

    monkeypatch.setattr(store, "write", broken)
    with pytest.raises(OSError):
        record_fetch(db, store, spec, T0 + H, T0 + 2 * H, _batch(T0 + H, 60))
    assert covered_ranges(db, "BTCUSDT", "binance") == [(T0, T0 + H)]


@requires_db
def test_weekend_with_no_rows_counts_as_covered_without_gaps(db, tmp_path):  # noqa: F811
    mirror_to_db(db)
    reset_coverage(db, "EURUSD")
    store, spec = LocalParquetStore(tmp_path), get_instrument("EURUSD")
    saturday = int(datetime(2026, 2, 7, tzinfo=timezone.utc).timestamp() * 1000)
    record_fetch(db, store, spec, saturday, saturday + 12 * H, Candles.empty())
    assert find_gaps(db, "EURUSD", "dukascopy", saturday, saturday + 12 * H) == []
    stat = db.query(CandleMonthStat).filter_by(instrument="EURUSD", source="dukascopy", year=2026, month=2).one()
    assert stat.gap_minutes == 0 and stat.row_count == 0


@requires_db
def test_mark_covered_merges_with_existing(ctx):
    db, store, _ = ctx
    mark_covered(db, store, "BTCUSDT", "binance", T0, T0 + H)
    mark_covered(db, store, "BTCUSDT", "binance", T0 + 2 * H, T0 + 3 * H)
    mark_covered(db, store, "BTCUSDT", "binance", T0 + H, T0 + 2 * H)
    assert covered_ranges(db, "BTCUSDT", "binance") == [(T0, T0 + 3 * H)]
