"""Maps HistData symbol folders to registry instruments (name, class, tick size, contract size)."""

from __future__ import annotations

from dataclasses import dataclass

from app.services.marketdata.registry import InstrumentSpec

SOURCE = "dukascopy"
FOREX_CONTRACT = 100_000.0
PRELOAD_YEARS = 20


@dataclass(frozen=True)
class CatalogEntry:
    folder: str
    symbol: str
    asset_class: str
    pip_size: float
    contract_size: float
    quote_currency: str
    price_decimals: int


def _spec(folder: str, symbol: str, asset_class: str, pip: float, contract: float, quote: str, decimals: int) -> CatalogEntry:
    return CatalogEntry(folder, symbol, asset_class, pip, contract, quote, decimals)


_INDICES = {
    "SPXUSD": _spec("SPXUSD", "US500", "index", 0.1, 1.0, "USD", 1),
    "NSXUSD": _spec("NSXUSD", "US100", "index", 0.1, 1.0, "USD", 1),
    "GRXEUR": _spec("GRXEUR", "DE40", "index", 1.0, 1.0, "EUR", 1),
    "UKXGBP": _spec("UKXGBP", "UK100", "index", 1.0, 1.0, "GBP", 1),
    "FRXEUR": _spec("FRXEUR", "FR40", "index", 1.0, 1.0, "EUR", 1),
    "ETXEUR": _spec("ETXEUR", "EU50", "index", 1.0, 1.0, "EUR", 1),
    "JPXJPY": _spec("JPXJPY", "JP225", "index", 1.0, 1.0, "JPY", 1),
    "HKXHKD": _spec("HKXHKD", "HK50", "index", 1.0, 1.0, "HKD", 1),
    "AUXAUD": _spec("AUXAUD", "AU200", "index", 1.0, 1.0, "AUD", 1),
    "UDXUSD": _spec("UDXUSD", "DXY", "index", 0.01, 1000.0, "USD", 3),
}
_COMMODITIES = {
    "WTIUSD": _spec("WTIUSD", "USOIL", "commodity", 0.01, 1000.0, "USD", 2),
    "BCOUSD": _spec("BCOUSD", "UKOIL", "commodity", 0.01, 1000.0, "USD", 2),
}
_NO_PIP_DECIMALS = {"JPY": (0.01, 3), "HUF": (0.01, 3)}


def _metal(folder: str) -> CatalogEntry:
    metal, quote = folder[:3], folder[3:]
    if metal == "XAU":
        return _spec(folder, folder, "metal", 0.01, 100.0, quote, 2)
    return _spec(folder, folder, "metal", 0.001, 5000.0, quote, 3)


def _pair(folder: str) -> CatalogEntry:
    quote = folder[3:]
    pip, decimals = _NO_PIP_DECIMALS.get(quote, (0.0001, 5))
    return _spec(folder, folder, "forex", pip, FOREX_CONTRACT, quote, decimals)


def entry_for(folder: str) -> CatalogEntry | None:
    key = folder.strip().upper()
    if key in _INDICES:
        return _INDICES[key]
    if key in _COMMODITIES:
        return _COMMODITIES[key]
    if len(key) == 6 and key.isalpha() and key[:3] in ("XAU", "XAG"):
        return _metal(key)
    if len(key) == 6 and key.isalpha():
        return _pair(key)
    return None


def to_spec(entry: CatalogEntry, *, enabled: bool = False, verified_on=None) -> InstrumentSpec:
    return InstrumentSpec(
        symbol=entry.symbol,
        asset_class=entry.asset_class,
        source=SOURCE,
        provider_id=entry.folder.lower(),
        market_type="spot",
        pip_size=entry.pip_size,
        contract_size=entry.contract_size,
        quote_currency=entry.quote_currency,
        price_decimals=entry.price_decimals,
        preload_years=PRELOAD_YEARS,
        enabled=enabled,
        verified_on=verified_on,
    )
