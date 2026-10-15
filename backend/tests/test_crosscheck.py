"""Daily cross-check against mocked references (F5). No live network."""

from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.core.config import settings
from app.models.market_data import CrosscheckResult
from app.services.marketdata.candles import Candles
from app.services.marketdata.crosscheck import ecb_cross, fixing_ms, parse_ecb_csv, run_crosscheck
from app.services.marketdata.registry import get_instrument, mirror_to_db
from app.services.marketdata.store import LocalParquetStore
from tests.bt_support import db, requires_db

pytestmark = requires_db

DAY = date(2024, 6, 4)


def _bars(start_ms: int, count: int, close: float, high: float, low: float) -> Candles:
    return Candles.from_rows((start_ms + i * 60_000, close, high, low, close, 1.0) for i in range(count))


def test_fixing_minute_follows_berlin_summer_and_winter():
    winter = int(datetime(2024, 1, 16, 13, 10, tzinfo=timezone.utc).timestamp() * 1000)
    summer = int(datetime(2024, 6, 4, 12, 10, tzinfo=timezone.utc).timestamp() * 1000)
    assert fixing_ms(date(2024, 1, 16)) == winter
    assert fixing_ms(date(2024, 6, 4)) == summer


def test_ecb_cross_and_csv():
    rates = {"USD": 1.08, "JPY": 160.0, "GBP": 0.85}
    assert ecb_cross("EUR", "USD", rates) == pytest.approx(1.08)
    assert ecb_cross("USD", "JPY", rates) == pytest.approx(160.0 / 1.08)
    assert ecb_cross("GBP", "USD", rates) == pytest.approx(1.08 / 0.85)
    parsed = parse_ecb_csv('KEY,CURRENCY,OBS_VALUE\nD,USD,1.1208\nD,JPY,177.06\n')
    assert parsed["USD"] == pytest.approx(1.1208)


def test_crypto_matches_daily_klines_and_a_failure_does_not_stop_the_run(db, tmp_path, monkeypatch):
    mirror_to_db(db)
    store = LocalParquetStore(tmp_path)
    start = int(datetime(2024, 6, 4, tzinfo=timezone.utc).timestamp() * 1000)
    store.write("binance", "BTCUSDT", _bars(start, 3, close=100, high=102, low=99))
    btc = get_instrument("BTCUSDT")
    gold = get_instrument("XAUUSD")

    def daily(symbol, day):
        if symbol == "BTCUSDT":
            return {"high": 102.0, "low": 99.0, "close": 100.0}
        raise AssertionError(symbol)

    notes = run_crosscheck(db, day=DAY, specs=[btc, gold], store=store, daily_fetcher=daily, ecb_fetcher=lambda _day: None)
    by_symbol = {note["symbol"]: note["status"] for note in notes}
    assert by_symbol == {"BTCUSDT": "ok", "XAUUSD": "no_reference"}

    def exploding(symbol, day):
        raise RuntimeError("reference down")

    notes = run_crosscheck(db, day=DAY, specs=[btc, gold], store=store, daily_fetcher=exploding, ecb_fetcher=lambda _day: None)
    assert {note["symbol"] for note in notes} == {"BTCUSDT", "XAUUSD"}
    assert next(note["status"] for note in notes if note["symbol"] == "BTCUSDT") == "difference"
    assert next(note["status"] for note in notes if note["symbol"] == "XAUUSD") == "no_reference"

    def far(symbol, day):
        return {"high": 102.0, "low": 99.0, "close": 110.0}

    notes = run_crosscheck(db, day=DAY, specs=[btc], store=store, daily_fetcher=far, ecb_fetcher=lambda _day: None)
    assert notes[0]["status"] == "difference"

    monkeypatch.setattr(settings, "crosscheck_retention_days", 1)
    older = DAY - timedelta(days=2)
    run_crosscheck(db, day=older, specs=[gold], store=store, daily_fetcher=daily, ecb_fetcher=lambda _day: None)
    run_crosscheck(db, day=DAY, specs=[gold], store=store, daily_fetcher=daily, ecb_fetcher=lambda _day: None)
    kept = list(db.scalars(select(CrosscheckResult).where(CrosscheckResult.instrument == "XAUUSD")))
    assert {row.day for row in kept} == {DAY}


def test_forex_uses_the_fixing_candle_not_the_daily_close(db, tmp_path):
    mirror_to_db(db)
    store = LocalParquetStore(tmp_path)
    start = int(datetime(2024, 6, 4, tzinfo=timezone.utc).timestamp() * 1000)
    later = start + 20 * 60 * 60_000
    store.write("dukascopy", "EURUSD", _bars(start, 2, close=9.0, high=9.1, low=8.9))
    store.write("dukascopy", "EURUSD", _bars(fixing_ms(DAY), 1, close=1.08, high=1.081, low=1.079))
    store.write("dukascopy", "EURUSD", _bars(later, 1, close=5.0, high=5.1, low=4.9))
    notes = run_crosscheck(
        db,
        day=DAY,
        specs=[get_instrument("EURUSD")],
        store=store,
        daily_fetcher=lambda *_args: None,
        ecb_fetcher=lambda _day: {"USD": 1.08},
    )
    assert notes[0]["status"] == "ok"
    row = db.scalar(select(CrosscheckResult).where(CrosscheckResult.instrument == "EURUSD"))
    assert row.stored_close == pytest.approx(1.08)
    assert row.reference_close == pytest.approx(1.08)
