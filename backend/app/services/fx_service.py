"""Latest-available FX quotes via a delayed public provider.

No API key is required. Rates are ECB-style daily figures from ExchangeRate-API's
open endpoint — never described as live/real-time.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal

import httpx
from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger(__name__)

Freshness = Literal["latest", "cached", "stale"]

CURRENCY_META: dict[str, tuple[str, str, str, int]] = {
    # code: (name, symbol, flag, decimals)
    "USD": ("US Dollar", "$", "US", 2),
    "EUR": ("Euro", "€", "EU", 2),
    "GBP": ("British Pound", "£", "GB", 2),
    "JPY": ("Japanese Yen", "¥", "JP", 0),
    "INR": ("Indian Rupee", "₹", "IN", 2),
    "AUD": ("Australian Dollar", "A$", "AU", 2),
    "CAD": ("Canadian Dollar", "C$", "CA", 2),
    "CHF": ("Swiss Franc", "CHF", "CH", 2),
    "SGD": ("Singapore Dollar", "S$", "SG", 2),
    "AED": ("UAE Dirham", "د.إ", "AE", 2),
    "CNY": ("Chinese Yuan", "¥", "CN", 2),
    "HKD": ("Hong Kong Dollar", "HK$", "HK", 2),
    "NZD": ("New Zealand Dollar", "NZ$", "NZ", 2),
    "KRW": ("South Korean Won", "₩", "KR", 0),
    "BRL": ("Brazilian Real", "R$", "BR", 2),
    "MXN": ("Mexican Peso", "MX$", "MX", 2),
    "ZAR": ("South African Rand", "R", "ZA", 2),
    "SEK": ("Swedish Krona", "kr", "SE", 2),
    "NOK": ("Norwegian Krone", "kr", "NO", 2),
    "DKK": ("Danish Krone", "kr", "DK", 2),
    "PLN": ("Polish Zloty", "zł", "PL", 2),
    "TRY": ("Turkish Lira", "₺", "TR", 2),
    "THB": ("Thai Baht", "฿", "TH", 2),
    "PHP": ("Philippine Peso", "₱", "PH", 2),
    "IDR": ("Indonesian Rupiah", "Rp", "ID", 0),
    "MYR": ("Malaysian Ringgit", "RM", "MY", 2),
    "ILS": ("Israeli Shekel", "₪", "IL", 2),
    "CZK": ("Czech Koruna", "Kč", "CZ", 2),
    "HUF": ("Hungarian Forint", "Ft", "HU", 0),
    "RON": ("Romanian Leu", "lei", "RO", 2),
    "BGN": ("Bulgarian Lev", "лв", "BG", 2),
    "ISK": ("Icelandic Krona", "kr", "IS", 0),
}


@dataclass
class FxTable:
    base: str
    rates: dict[str, float]
    rate_timestamp: datetime | None
    fetched_at: datetime
    source: str
    attribution: str
    delayed: bool


@dataclass
class FxQuote:
    base: str
    quote: str
    rate: float
    rate_timestamp: datetime | None
    fetched_at: datetime
    source: str
    attribution: str
    delayed: bool
    freshness: Freshness
    cache_ttl_seconds: int


_fresh: tuple[float, FxTable] | None = None
_last_good: FxTable | None = None


def _now() -> datetime:
    return datetime.now(timezone.utc)


def reset_cache() -> None:
    global _fresh, _last_good
    _fresh = None
    _last_good = None


def normalize_code(value: str) -> str:
    return (value or "").strip().upper()


def pair_rate(table: FxTable, base: str, quote: str) -> float:
    """Cross rate from a USD-quoted table. Full precision, no rounding."""
    base_c = normalize_code(base)
    quote_c = normalize_code(quote)
    if base_c == quote_c:
        return 1.0

    def usd_per(code: str) -> float:
        if code == table.base:
            return 1.0
        rate = table.rates.get(code)
        if rate is None or rate <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported currency: {code}",
            )
        return rate

    return usd_per(quote_c) / usd_per(base_c)


def convert_amount(amount: float, rate: float) -> float:
    return amount * rate


def display_rate(rate: float) -> str:
    if rate >= 10:
        return f"{rate:.2f}"
    if rate >= 1:
        text = f"{rate:.4f}"
        return text.rstrip("0").rstrip(".") if len(text.rstrip("0").rstrip(".")) >= 3 else f"{rate:.2f}"
    if rate >= 0.01:
        return f"{rate:.4f}"
    return f"{rate:.6f}"


def _parse_provider(payload: dict) -> FxTable:
    if payload.get("result") not in (None, "success"):
        raise ValueError("Provider returned an unsuccessful result")
    rates_raw = payload.get("rates")
    if not isinstance(rates_raw, dict):
        raise ValueError("Provider payload missing rates")
    rates: dict[str, float] = {}
    for code, value in rates_raw.items():
        try:
            rates[str(code).upper()] = float(value)
        except (TypeError, ValueError):
            continue
    if not rates:
        raise ValueError("Provider returned no usable rates")

    ts: datetime | None = None
    unix = payload.get("time_last_update_unix")
    if unix is not None:
        try:
            ts = datetime.fromtimestamp(int(unix), tz=timezone.utc)
        except (TypeError, ValueError, OSError):
            ts = None
    if ts is None:
        date_s = payload.get("date") or payload.get("time_last_update_utc")
        if isinstance(date_s, str) and len(date_s) >= 10:
            try:
                ts = datetime.fromisoformat(date_s[:10]).replace(tzinfo=timezone.utc)
            except ValueError:
                ts = None

    base = str(payload.get("base_code") or payload.get("base") or "USD").upper()
    return FxTable(
        base=base,
        rates=rates,
        rate_timestamp=ts,
        fetched_at=_now(),
        source="ExchangeRate-API",
        attribution="Rates by ExchangeRate-API.com",
        delayed=True,
    )


def fetch_usd_table(client: httpx.Client | None = None) -> FxTable:
    url = settings.fx_provider_url
    owns = client is None
    http = client or httpx.Client(timeout=8.0)
    try:
        response = http.get(url)
        response.raise_for_status()
        table = _parse_provider(response.json())
        logger.info("fx table fetched base=%s count=%s", table.base, len(table.rates))
        return table
    finally:
        if owns:
            http.close()


def _store(table: FxTable) -> None:
    global _fresh, _last_good
    _fresh = (time.monotonic(), table)
    _last_good = table


def load_table(*, force_refresh: bool = False, client: httpx.Client | None = None) -> tuple[FxTable, Freshness]:
    ttl = max(30, int(settings.fx_cache_ttl_seconds))
    now_mono = time.monotonic()
    if not force_refresh and _fresh is not None:
        cached_at, table = _fresh
        if now_mono - cached_at < ttl:
            return table, "cached"

    try:
        table = fetch_usd_table(client)
        _store(table)
        return table, "latest"
    except (httpx.HTTPError, ValueError, KeyError) as exc:
        logger.warning("fx provider failed: %s", exc)
        if _last_good is not None:
            return _last_good, "stale"
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to retrieve the latest exchange rate.",
        ) from exc


def get_quote(
    base: str,
    quote: str,
    *,
    force_refresh: bool = False,
    client: httpx.Client | None = None,
) -> FxQuote:
    base_c = normalize_code(base)
    quote_c = normalize_code(quote)
    if len(base_c) != 3 or len(quote_c) != 3 or not base_c.isalpha() or not quote_c.isalpha():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid currency")

    table, freshness = load_table(force_refresh=force_refresh, client=client)
    rate = pair_rate(table, base_c, quote_c)
    return FxQuote(
        base=base_c,
        quote=quote_c,
        rate=rate,
        rate_timestamp=table.rate_timestamp,
        fetched_at=table.fetched_at,
        source=table.source,
        attribution=table.attribution,
        delayed=table.delayed,
        freshness=freshness,
        cache_ttl_seconds=max(30, int(settings.fx_cache_ttl_seconds)),
    )


def list_currencies(*, client: httpx.Client | None = None) -> list[dict]:
    table, _freshness = load_table(client=client)
    codes = {table.base, *table.rates.keys()}
    items: list[dict] = []
    for code in sorted(codes):
        meta = CURRENCY_META.get(code)
        if meta:
            name, symbol, flag, decimals = meta
        else:
            name, symbol, flag, decimals = (code, code, code[:2], 2)
        items.append(
            {
                "code": code,
                "name": name,
                "symbol": symbol,
                "flag": flag,
                "decimals": decimals,
            }
        )
    return items
