"""verify-instrument (D-027): fetch one real recent day and sanity-check it before enabling an instrument."""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone

from app.services.marketdata.candles import Candles
from app.services.marketdata.providers import Provider, ProviderError, get_provider
from app.services.marketdata.registry import InstrumentSpec, mark_verified
from app.services.marketdata.validation import closed_windows, validate_batch

DAY_MS = 86_400_000

PRICE_BOUNDS: dict[str, tuple[float, float]] = {
    "BTCUSDT": (1_000.0, 1_000_000.0),
    "BTCUSDT_PERP": (1_000.0, 1_000_000.0),
    "ETHUSDT": (50.0, 100_000.0),
    "ETHUSDT_PERP": (50.0, 100_000.0),
    "EURUSD": (0.5, 2.0),
    "XAUUSD": (500.0, 20_000.0),
    "XAGUSD": (3.0, 500.0),
}
CLASS_BOUNDS: dict[str, tuple[float, float]] = {
    "forex": (0.001, 500.0),
    "metal": (1.0, 50_000.0),
    "index": (100.0, 200_000.0),
    "crypto": (1e-6, 10_000_000.0),
}
MIN_OPEN_COVERAGE = 0.85


@dataclass
class VerifyResult:
    symbol: str
    day: date
    rows: int = 0
    expected_open_minutes: int = 0
    price_min: float | None = None
    price_max: float | None = None
    problems: list[str] = field(default_factory=list)
    written: bool = False

    @property
    def ok(self) -> bool:
        return not self.problems


def last_complete_day(now_ms: int | None = None) -> date:
    now = datetime.fromtimestamp((now_ms or int(time.time() * 1000)) / 1000, tz=timezone.utc)
    return (now - timedelta(days=1)).date()


def verification_day(spec: InstrumentSpec, now_ms: int | None = None) -> date:
    """Yesterday for crypto; the most recent completed Tuesday-to-Thursday session otherwise, so weekend
    closures and the Sunday open never make a healthy feed look sparse."""
    day = last_complete_day(now_ms)
    if spec.asset_class == "crypto":
        return day
    while day.weekday() not in (1, 2, 3):
        day -= timedelta(days=1)
    return day


def _open_minutes(asset_class: str, start_ms: int, end_ms: int) -> int:
    closed = sum(b - a for a, b in closed_windows(asset_class, start_ms, end_ms))
    return (end_ms - start_ms - closed) // 60_000


def verify_instrument(
    spec: InstrumentSpec, *, provider: Provider | None = None, day: date | None = None, now_ms: int | None = None
) -> VerifyResult:
    day = day or verification_day(spec, now_ms)
    start = int(datetime(day.year, day.month, day.day, tzinfo=timezone.utc).timestamp() * 1000)
    end = start + DAY_MS
    result = VerifyResult(spec.symbol, day, expected_open_minutes=_open_minutes(spec.asset_class, start, end))
    provider = provider or get_provider(spec.source)
    try:
        candles = Candles.concat(*(chunk.candles for chunk in provider.iter_chunks(spec, start, end)))
    except ProviderError as exc:
        result.problems.append(f"fetch failed ({exc.code}): {exc.message}")
        return result
    clean, report = validate_batch(candles, symbol=spec.symbol)
    result.rows = len(clean)
    if report.rejected:
        result.problems.append(f"validation rejected rows: {report.rejected}")
    if result.expected_open_minutes and result.rows < MIN_OPEN_COVERAGE * result.expected_open_minutes:
        result.problems.append(f"only {result.rows} of ~{result.expected_open_minutes} open-market minutes returned")
    if len(clean):
        result.price_min, result.price_max = float(clean.low.min()), float(clean.high.max())
        low, high = PRICE_BOUNDS.get(spec.symbol, CLASS_BOUNDS[spec.asset_class])
        if result.price_min < low or result.price_max > high:
            result.problems.append(f"prices {result.price_min}..{result.price_max} outside sanity range {low}..{high}")
    return result


def verify_and_record(spec: InstrumentSpec, *, write: bool, provider: Provider | None = None) -> VerifyResult:
    result = verify_instrument(spec, provider=provider)
    if write and result.ok:
        mark_verified(spec.symbol, datetime.now(timezone.utc).date())
        result.written = True
    return result
