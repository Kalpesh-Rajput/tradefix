"""Compare stored 1-minute candles with an independent daily reference (F5, D-043).

Crypto uses Binance daily klines, which are not the 1-minute files. Forex uses the ECB euro
reference rates. The ECB says those rates come from the concertation procedure that normally
takes place around 14:10 CET, and that the rates are published around 16:00 CET
(https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html).
The forex comparison uses the stored 1-minute candle at 14:10 Europe/Berlin, not the daily close.
Metals and anything else have no reference here. One instrument failing does not stop the others.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.market_data import CrosscheckResult
from app.services.marketdata.registry import InstrumentSpec, enabled_instruments
from app.services.marketdata.store import CandleStore, get_store

logger = logging.getLogger("tradefix.marketdata")

BERLIN = ZoneInfo("Europe/Berlin")
DAY_MS = 86_400_000
MINUTE_MS = 60_000


def fixing_ms(day: date) -> int:
    """14:10 Europe/Berlin on that calendar day, as UTC milliseconds. CET and CEST both apply."""
    moment = datetime(day.year, day.month, day.day, 14, 10, tzinfo=BERLIN)
    return int(moment.timestamp() * 1000)


def ecb_cross(base: str, quote: str, per_eur: dict[str, float]) -> float | None:
    """ECB quotes foreign currency per 1 euro. A pair is quote-per-euro divided by base-per-euro."""

    def per_one_euro(currency: str) -> float | None:
        if currency == "EUR":
            return 1.0
        value = per_eur.get(currency)
        return None if value in (None, 0) else float(value)

    base_rate, quote_rate = per_one_euro(base), per_one_euro(quote)
    if base_rate is None or quote_rate is None:
        return None
    return quote_rate / base_rate


def _pair(symbol: str) -> tuple[str, str] | None:
    if len(symbol) == 6 and symbol.isalpha():
        return symbol[:3], symbol[3:]
    return None


def fetch_binance_daily(symbol: str, day: date) -> dict | None:
    start = int(datetime(day.year, day.month, day.day, tzinfo=timezone.utc).timestamp() * 1000)
    response = httpx.get(
        "https://api.binance.com/api/v3/klines",
        params={"symbol": symbol, "interval": "1d", "startTime": start, "endTime": start + DAY_MS - 1, "limit": 1},
        timeout=20,
    )
    response.raise_for_status()
    rows = response.json()
    if not rows:
        return None
    row = rows[0]
    return {"high": float(row[2]), "low": float(row[3]), "close": float(row[4])}


def parse_ecb_csv(text: str) -> dict[str, float] | None:
    rates: dict[str, float] = {}
    lines = [line for line in text.splitlines() if line.strip()]
    if len(lines) < 2:
        return None
    header = [cell.strip().strip('"') for cell in lines[0].split(",")]
    try:
        currency_at = header.index("CURRENCY")
        value_at = header.index("OBS_VALUE")
    except ValueError:
        return None
    for line in lines[1:]:
        cells = [cell.strip().strip('"') for cell in line.split(",")]
        if len(cells) <= max(currency_at, value_at) or not cells[value_at]:
            continue
        try:
            rates[cells[currency_at]] = float(cells[value_at])
        except ValueError:
            continue
    return rates or None


def fetch_ecb_rates(day: date) -> dict[str, float] | None:
    response = httpx.get(
        "https://data-api.ecb.europa.eu/service/data/EXR/D..EUR.SP00.A",
        params={"startPeriod": day.isoformat(), "endPeriod": day.isoformat(), "format": "csvdata"},
        timeout=20,
    )
    response.raise_for_status()
    return parse_ecb_csv(response.text)


def _pct(stored: float, reference: float) -> float:
    return abs(stored - reference) / abs(reference) * 100


def _save(db: Session, spec: InstrumentSpec, day: date, values: dict) -> None:
    table = CrosscheckResult.__table__
    stmt = insert(table).values(instrument=spec.symbol, day=day, **values)
    db.execute(
        stmt.on_conflict_do_update(
            constraint="uq_crosscheck_day",
            set_={key: stmt.excluded[key] for key in values},
        )
    )


def _crypto(spec: InstrumentSpec, day: date, store: CandleStore, daily) -> dict:
    start = int(datetime(day.year, day.month, day.day, tzinfo=timezone.utc).timestamp() * 1000)
    candles = store.read(spec.source, spec.symbol, start, start + DAY_MS)
    reference = daily(spec.provider_id, day)
    tolerance = settings.crosscheck_tolerance_pct
    if reference is None:
        return {"status": "no_reference", "tolerance": tolerance, "detail": {"reason": "no daily kline"}, "stored_close": None, "stored_high": None, "stored_low": None, "reference_close": None, "difference": None}
    if not len(candles):
        return {"status": "difference", "tolerance": tolerance, "detail": {"reason": "no stored candles"}, "reference_close": reference["close"], "stored_close": None, "stored_high": None, "stored_low": None, "difference": None}
    stored = {"close": float(candles.close[-1]), "high": float(candles.high.max()), "low": float(candles.low.min())}
    gaps = {name: _pct(stored[name], reference[name]) for name in ("close", "high", "low")}
    worst = max(gaps.values())
    return {
        "status": "ok" if worst <= tolerance else "difference",
        "tolerance": tolerance,
        "stored_close": stored["close"],
        "stored_high": stored["high"],
        "stored_low": stored["low"],
        "reference_close": reference["close"],
        "difference": worst,
        "detail": {"gaps_pct": gaps, "reference_high": reference["high"], "reference_low": reference["low"]},
    }


def _forex(spec: InstrumentSpec, day: date, store: CandleStore, rates: dict[str, float] | None) -> dict:
    tolerance = settings.crosscheck_forex_tolerance_pct
    pair = _pair(spec.symbol)
    empty = {"tolerance": tolerance, "stored_close": None, "stored_high": None, "stored_low": None, "reference_close": None, "difference": None}
    if rates is None or pair is None:
        return {"status": "no_reference", "detail": {"reason": "no ECB rate for this day"}, **empty}
    reference = ecb_cross(pair[0], pair[1], rates)
    if reference is None:
        return {"status": "no_reference", "detail": {"reason": "ECB does not quote this pair"}, **empty}
    moment = fixing_ms(day)
    candles = store.read(spec.source, spec.symbol, moment, moment + MINUTE_MS)
    if not len(candles):
        return {"status": "difference", "detail": {"reason": "no stored candle at 14:10 Europe/Berlin", "fixing_ms": moment}, "reference_close": reference, **empty}
    stored_close = float(candles.close[-1])
    gap = _pct(stored_close, reference)
    return {
        "status": "ok" if gap <= tolerance else "difference",
        "tolerance": tolerance,
        "stored_close": stored_close,
        "stored_high": float(candles.high[-1]),
        "stored_low": float(candles.low[-1]),
        "reference_close": reference,
        "difference": gap,
        "detail": {"fixing_ms": moment, "compared": "close at 14:10 Europe/Berlin"},
    }


def run_crosscheck(
    db: Session,
    *,
    day: date,
    specs: list[InstrumentSpec] | None = None,
    store: CandleStore | None = None,
    daily_fetcher=fetch_binance_daily,
    ecb_fetcher=fetch_ecb_rates,
) -> list[dict]:
    """Check every instrument. A failure on one is stored and the loop continues."""
    store = store or get_store()
    chosen = specs if specs is not None else enabled_instruments()
    ecb_rates: dict[str, float] | None = None
    ecb_loaded = False
    notes = []
    for spec in chosen:
        try:
            if spec.asset_class == "crypto" and spec.source == "binance":
                values = _crypto(spec, day, store, daily_fetcher)
            elif spec.asset_class == "forex":
                if not ecb_loaded:
                    ecb_loaded = True
                    ecb_rates = ecb_fetcher(day)
                values = _forex(spec, day, store, ecb_rates)
            else:
                values = {
                    "status": "no_reference",
                    "tolerance": settings.crosscheck_tolerance_pct,
                    "detail": {"reason": f"no reference for {spec.asset_class}"},
                    "stored_close": None,
                    "stored_high": None,
                    "stored_low": None,
                    "reference_close": None,
                    "difference": None,
                }
        except Exception as exc:
            logger.exception("cross-check instrument failed", extra={"symbol": spec.symbol})
            values = {
                "status": "difference",
                "tolerance": settings.crosscheck_tolerance_pct,
                "detail": {"reason": str(exc)[:300]},
                "stored_close": None,
                "stored_high": None,
                "stored_low": None,
                "reference_close": None,
                "difference": None,
            }
        _save(db, spec, day, values)
        notes.append({"symbol": spec.symbol, "status": values["status"], "difference": values.get("difference")})
    cutoff = day - timedelta(days=settings.crosscheck_retention_days)
    db.execute(delete(CrosscheckResult).where(CrosscheckResult.day < cutoff))
    db.commit()
    logger.info("cross-check finished", extra={"summary": notes, "day": day.isoformat()})
    return notes
