"""Symbol resolver (backtesting 1D)."""

from __future__ import annotations

import pytest

from app.models.market_data import UnresolvedSymbol
from app.services.marketdata.registry import mirror_to_db
from app.services.marketdata.resolver import (
    ANY_BROKER,
    add_alias,
    candidate_symbols,
    normalize_broker,
    resolve_symbol,
    unresolved_report,
)
from tests.bt_support import db, requires_db  # noqa: F401

pytestmark = requires_db


@pytest.fixture()
def rdb(db):  # noqa: F811
    mirror_to_db(db)
    return db


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("EURUSD", "EURUSD"),
        ("eurusd", "EURUSD"),
        ("EURUSDm", "EURUSD"),
        ("EURUSD.m", "EURUSD"),
        ("EURUSD#", "EURUSD"),
        ("EURUSD.pro", "EURUSD"),
        ("EURUSD.raw", "EURUSD"),
        ("EURUSD.a", "EURUSD"),
        ("EURUSD.", "EURUSD"),
        ("#EURUSD", "EURUSD"),
        ("XAUUSD.ecn", "XAUUSD"),
        ("EUR/USD", "EURUSD"),
        ("EUR_USD", "EURUSD"),
        ("eur-usd", "EURUSD"),
        ("GBP/JPY.m", "GBPJPY"),
        ("GOLD", "XAUUSD"),
        ("Gold.m", "XAUUSD"),
        ("US500.cash", "US500"),
        ("SPX500", "US500"),
        ("NAS100", "US100"),
        ("USTEC", "US100"),
        ("US30.cash", "US30"),
        ("GER40", "DE40"),
        ("BTCUSDT", "BTCUSDT"),
        ("BTC/USDT", "BTCUSDT"),
        ("BTC-USDT", "BTCUSDT"),
        ("BTCUSD", "BTCUSDT"),
        ("ETHUSD.m", "ETHUSDT"),
    ],
)
def test_suffix_separator_and_generic_rules(rdb, raw, expected):
    result = resolve_symbol(rdb, "XM", raw, record=False)
    assert result.symbol == expected, (raw, result)


@pytest.mark.parametrize(
    "raw",
    ["BTCUSDT.P", "BTCUSDTPERP", "BTCUSDT_PERP", "BTC-USDT-SWAP", "BTCUSD_PERP", "BTC/USDT:USDT", "BTC-PERP"],
)
def test_perpetual_naming(rdb, raw):
    result = resolve_symbol(rdb, "bybit", raw, record=False)
    assert result.symbol == "BTCUSDT_PERP"
    assert result.instrument.market_type == "usdm_futures"


def test_market_type_hint_selects_perpetual(rdb):
    assert resolve_symbol(rdb, "api:binance", "ETHUSDT", market_type="futures", record=False).symbol == "ETHUSDT_PERP"
    assert resolve_symbol(rdb, "api:binance", "ETHUSDT", market_type="spot", record=False).symbol == "ETHUSDT"
    assert resolve_symbol(rdb, "api:binance", "SOLUSDT", market_type="futures", record=False).symbol == "SOLUSDT"


def test_alias_table_broker_specific_beats_wildcard(rdb):
    add_alias(rdb, ANY_BROKER, "XYZFX", "EURUSD")
    add_alias(rdb, "Exness", "XYZFX", "GBPUSD")
    assert resolve_symbol(rdb, "api:exness", "XYZFX", record=False).symbol == "GBPUSD"
    assert resolve_symbol(rdb, "oanda", "xyzfx", record=False).symbol == "EURUSD"
    assert resolve_symbol(rdb, "oanda", "xyzfx", record=False).method == "alias"
    with pytest.raises(ValueError):
        add_alias(rdb, ANY_BROKER, "Q", "NOPE")


def test_other_crypto_exchanges_are_marked_binance_proxy(rdb):
    assert resolve_symbol(rdb, "api:bybit", "SOLUSDT", record=False).price_note == "binance_proxy"
    assert resolve_symbol(rdb, "api:binance", "SOLUSDT", record=False).price_note is None
    assert resolve_symbol(rdb, "api:bybit", "EURUSD", record=False).price_note is None


def test_unresolved_counter(rdb):
    for _ in range(3):
        result = resolve_symbol(rdb, "Zerodha", "NIFTY24OCTFUT")
        assert not result.resolved and result.method == "unresolved"
    resolve_symbol(rdb, "Zerodha", "BANKNIFTY")
    rdb.flush()
    row = rdb.query(UnresolvedSymbol).filter_by(broker="zerodha", raw_symbol="NIFTY24OCTFUT").one()
    assert row.count == 3
    report = [(r.raw_symbol, r.count) for r in unresolved_report(rdb) if r.broker == "zerodha"]
    assert report[0] == ("NIFTY24OCTFUT", 3)


def test_helpers():
    assert normalize_broker(" API:Binance ") == "binance"
    assert normalize_broker(None) == "unknown"
    assert candidate_symbols("") == []
    assert candidate_symbols("EURUSD")[0] == ("EURUSD", "exact")
