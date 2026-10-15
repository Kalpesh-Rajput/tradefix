"""File import, price-side guard, and stored verification (F4). No network."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_current_user, get_db
from app.main import app
from app.services.marketdata.importer import CandleImportError, _layout, import_candles, parse_files
from app.services.marketdata.providers.base import ProviderBlocked
from app.services.marketdata.providers.cooldown import raise_if_blocked, record
from app.services.marketdata.registry import get_instrument, mirror_to_db
from app.services.marketdata.store import LocalParquetStore
from app.services.marketdata.verify import month_is_full, verify_stored
from tests.bt_support import db, make_user, requires_db

pytestmark = requires_db

EUR = (
    "Gmt time,Open,High,Low,Close,Volume\n"
    "03.06.2024 00:00:00.000,1.08000,1.08020,1.07980,1.08010,10\n"
    "03.06.2024 00:01:00.000,1.08010,1.08030,1.07990,1.08020,11\n"
)


def test_histdata_times_are_utc_minus_five_without_dst():
    layout = _layout("histdata", time_format="", separator=";", columns="", timezone_name="")
    rows, rejected = parse_files([("m1.csv", b"20240603 000000;1.08000;1.08020;1.07980;1.08010;10\n")], layout)
    expected = int(datetime(2024, 6, 3, 5, tzinfo=timezone.utc).timestamp() * 1000)
    assert rejected == {} and rows[0][0] == expected


def test_dukascopy_sample_imports_once_and_refuses_a_different_side(db, tmp_path: Path):
    mirror_to_db(db)
    spec = get_instrument("EURUSD")
    store = LocalParquetStore(tmp_path)
    path = tmp_path / "eur.csv"
    path.write_text(EUR, encoding="utf-8")
    dry = import_candles(db, spec, path, preset="dukascopy", label="desk export", price_side="bid", store=store, dry_run=True)
    assert dry.dry_run and dry.rows_kept == 2 and dry.gap_minutes == 0
    assert not list(tmp_path.rglob("*.parquet"))
    first = import_candles(db, spec, path, preset="dukascopy", label="desk export", price_side="bid", store=store)
    again = import_candles(db, spec, path, preset="dukascopy", label="desk export", price_side="bid", store=store)
    assert first.rows_kept == 2 and again.duplicate
    other = tmp_path / "mid.csv"
    other.write_text(EUR.replace(",10", ",12").replace(",11", ",13"), encoding="utf-8")
    with pytest.raises(CandleImportError, match="price sides"):
        import_candles(db, spec, other, preset="dukascopy", label="mid file", price_side="mid", store=store)
    checks = verify_stored(db, spec, store=store)
    by_name = {item.name: item for item in checks}
    assert by_name["validation"].passed and by_name["price_range"].passed
    assert not by_name["full_month"].passed
    assert month_is_full(20_000, 0, "forex") and not month_is_full(20_000, 1, "forex")


def test_generic_bad_row_is_counted(db, tmp_path: Path):
    mirror_to_db(db)
    spec = get_instrument("EURUSD")
    path = tmp_path / "generic.csv"
    path.write_text("not-a-date,1,1,1,1,1\n2024-06-03 00:02:00,1.08,1.0802,1.0798,1.0801,1\n", encoding="utf-8")
    summary = import_candles(
        db, spec, path, preset="generic", label="mapped", price_side="bid", store=LocalParquetStore(tmp_path),
        timezone_name="UTC", time_format="%Y-%m-%d %H:%M:%S", columns="time,open,high,low,close,volume",
    )
    assert summary.rejected.get("bad_row") == 1 and summary.rows_kept == 1


def test_cooldown_blocks_without_a_fresh_probe(db):
    record(db, "dukascopy", ProviderBlocked(http_status=202, excerpt="awswaf"))
    with pytest.raises(Exception) as exc:
        raise_if_blocked(db, "dukascopy")
    assert exc.value.code == "provider_blocked" and not isinstance(exc.value, ProviderBlocked)


def test_admin_import_endpoint(db, tmp_path: Path):
    mirror_to_db(db)
    admin = make_user(db, role="admin")
    trader = make_user(db)
    path = tmp_path / "eur.csv"
    path.write_text(EUR, encoding="utf-8")
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: trader
    client = TestClient(app)
    try:
        denied = client.post(
            "/api/admin/candle-imports",
            data={"symbol": "EURUSD", "preset": "dukascopy", "label": "x", "dry_run": "true"},
            files={"file": ("eur.csv", path.read_bytes(), "text/csv")},
        )
        assert denied.status_code == 403
        app.dependency_overrides[get_current_user] = lambda: admin
        allowed = client.post(
            "/api/admin/candle-imports",
            data={"symbol": "EURUSD", "preset": "dukascopy", "label": "desk export", "price_side": "bid", "dry_run": "true"},
            files={"file": ("eur.csv", path.read_bytes(), "text/csv")},
        )
        assert allowed.status_code == 200, allowed.text
        body = allowed.json()
        assert body["dry_run"] is True and body["rows_kept"] == 2
    finally:
        app.dependency_overrides.clear()
