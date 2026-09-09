"""Segment-aware instrument catalog.

Not a database table — a configuration layer so UI, calc, and future
broker imports share the same contract / pip / tick specs.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Segment = Literal["stock", "option", "future", "forex", "crypto"]


def normalize_symbol(symbol: str | None) -> str:
    return (symbol or "").upper().replace("/", "").replace("-", "").replace(" ", "")


# Lookup-only aliases — stored trade symbols are left unchanged.
FOREX_SYMBOL_ALIASES: dict[str, str] = {
    "GOLD": "XAUUSD",
    "XAU": "XAUUSD",
    "SILVER": "XAGUSD",
    "XAG": "XAGUSD",
}


def resolve_forex_lookup_symbol(symbol: str | None) -> str:
    """Map common aliases to catalog symbols for contract/pip/quote lookup."""
    key = normalize_symbol(symbol)
    return FOREX_SYMBOL_ALIASES.get(key, key)


@dataclass(frozen=True)
class Instrument:
    segment: Segment
    symbol: str
    display: str
    contract_size: float | None = None
    pip_size: float | None = None
    quote: str | None = None
    tick_size: float | None = None
    tick_value: float | None = None
    lot_size: float | None = None
    margin_hint: float | None = None


EQUITY: tuple[Instrument, ...] = (
    Instrument("stock", "AAPL", "AAPL"),
    Instrument("stock", "MSFT", "MSFT"),
    Instrument("stock", "TSLA", "TSLA"),
    Instrument("stock", "NVDA", "NVDA"),
    Instrument("stock", "AMZN", "AMZN"),
    Instrument("stock", "GOOGL", "GOOGL"),
    Instrument("stock", "META", "META"),
    Instrument("stock", "SPY", "SPY"),
    Instrument("stock", "QQQ", "QQQ"),
)

FOREX: tuple[Instrument, ...] = (
    Instrument("forex", "EURUSD", "EUR/USD", contract_size=100_000, pip_size=0.0001, quote="USD"),
    Instrument("forex", "GBPUSD", "GBP/USD", contract_size=100_000, pip_size=0.0001, quote="USD"),
    Instrument("forex", "USDJPY", "USD/JPY", contract_size=100_000, pip_size=0.01, quote="JPY"),
    Instrument("forex", "USDCHF", "USD/CHF", contract_size=100_000, pip_size=0.0001, quote="CHF"),
    Instrument("forex", "AUDUSD", "AUD/USD", contract_size=100_000, pip_size=0.0001, quote="USD"),
    Instrument("forex", "USDCAD", "USD/CAD", contract_size=100_000, pip_size=0.0001, quote="CAD"),
    Instrument("forex", "NZDUSD", "NZD/USD", contract_size=100_000, pip_size=0.0001, quote="USD"),
    Instrument("forex", "XAUUSD", "XAU/USD", contract_size=100, pip_size=0.01, quote="USD"),
    Instrument("forex", "XAGUSD", "XAG/USD", contract_size=5000, pip_size=0.01, quote="USD"),
)

CRYPTO: tuple[Instrument, ...] = (
    Instrument("crypto", "BTCUSD", "BTC/USD"),
    Instrument("crypto", "ETHUSD", "ETH/USD"),
    Instrument("crypto", "SOLUSD", "SOL/USD"),
)

OPTIONS: tuple[Instrument, ...] = (
    Instrument("option", "AAPL", "AAPL", lot_size=100),
    Instrument("option", "MSFT", "MSFT", lot_size=100),
    Instrument("option", "TSLA", "TSLA", lot_size=100),
    Instrument("option", "NVDA", "NVDA", lot_size=100),
    Instrument("option", "SPY", "SPY", lot_size=100),
    Instrument("option", "QQQ", "QQQ", lot_size=100),
)

FUTURES: tuple[Instrument, ...] = (
    Instrument("future", "ES", "ES", contract_size=50, tick_size=0.25, tick_value=12.50, margin_hint=12000),
    Instrument("future", "NQ", "NQ", contract_size=20, tick_size=0.25, tick_value=5.00, margin_hint=18000),
    Instrument("future", "GC", "GC", contract_size=100, tick_size=0.10, tick_value=10.00, margin_hint=10000),
    Instrument("future", "CL", "CL", contract_size=1000, tick_size=0.01, tick_value=10.00, margin_hint=7000),
)

CATALOG: dict[Segment, tuple[Instrument, ...]] = {
    "stock": EQUITY,
    "forex": FOREX,
    "crypto": CRYPTO,
    "option": OPTIONS,
    "future": FUTURES,
}


def instruments_for(segment: Segment | str) -> tuple[Instrument, ...]:
    return CATALOG.get(str(segment), ())  # type: ignore[arg-type]


def symbols_for(segment: Segment | str) -> list[str]:
    return [item.display for item in instruments_for(segment)]


def get_instrument(segment: Segment | str, symbol: str | None) -> Instrument | None:
    key = normalize_symbol(symbol)
    if not key:
        return None
    if str(segment) == "forex":
        key = resolve_forex_lookup_symbol(key)
    for item in instruments_for(segment):
        if normalize_symbol(item.symbol) == key or normalize_symbol(item.display) == key:
            return item
    return None


def default_pip_size(symbol: str | None) -> float:
    s = resolve_forex_lookup_symbol(symbol)
    if s.endswith("JPY") or s.startswith("XAU") or s.startswith("XAG"):
        return 0.01
    return 0.0001


def default_contract_size(segment: Segment | str, symbol: str | None) -> float:
    inst = get_instrument(segment, symbol)
    if inst and inst.contract_size:
        return float(inst.contract_size)
    if inst and inst.lot_size:
        return float(inst.lot_size)
    value = str(segment)
    if value == "forex":
        s = resolve_forex_lookup_symbol(symbol)
        if s.startswith("XAU"):
            return 100.0
        if s.startswith("XAG"):
            return 5000.0
        return 100_000.0
    if value == "option":
        return 100.0
    if value == "future":
        return 1.0
    return 1.0


def default_lot_size(symbol: str | None) -> float:
    inst = get_instrument("option", symbol)
    if inst and inst.lot_size:
        return float(inst.lot_size)
    return 100.0


def quote_currency(symbol: str | None) -> str:
    inst = get_instrument("forex", symbol)
    if inst and inst.quote:
        return inst.quote
    s = resolve_forex_lookup_symbol(symbol)
    if len(s) >= 6:
        return s[3:6]
    return "USD"
