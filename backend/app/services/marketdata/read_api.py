"""Request-level market-data logic behind /api/market-data (limits, quotas, preparing responses)."""

from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.job import Job
from app.models.user import User
from app.schemas.market_data import CandlesOut, DataJobOut, InstrumentOut
from app.services.backtest.errors import BacktestError, not_found
from app.services.marketdata.aggregation import TIMEFRAME_MINUTES, ceil_to, floor_to, timeframe_ms
from app.services.marketdata.candle_service import ensure_candles, get_candles
from app.services.marketdata.candles import MINUTE_MS
from app.services.marketdata.registry import InstrumentSpec, all_instruments, get_instrument
from app.services.marketdata.resolver import record_interest
from app.services.rate_limit import SlidingWindowRateLimiter

_candle_limiter: SlidingWindowRateLimiter | None = None


def _limiter() -> SlidingWindowRateLimiter:
    global _candle_limiter
    if _candle_limiter is None or _candle_limiter.max_calls != settings.candle_requests_per_minute:
        _candle_limiter = SlidingWindowRateLimiter(max_calls=settings.candle_requests_per_minute, window_seconds=60)
    return _candle_limiter


def check_candle_rate(user_id: uuid.UUID) -> None:
    if not _limiter().allow(f"candles:{user_id}"):
        raise BacktestError("rate_limited", "Too many chart requests. Wait a moment and try again.", retry_after_s=10)


def parse_time(value: str | int | None, field: str) -> int | None:
    """Epoch milliseconds, or an ISO 8601 timestamp (naive values are UTC)."""
    if value is None or value == "":
        return None
    text = str(value).strip()
    if text.lstrip("-").isdigit():
        return int(text)
    try:
        moment = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as exc:
        raise BacktestError("invalid_request", f"{field} must be epoch milliseconds or ISO 8601.") from exc
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return int(moment.timestamp() * 1000)


def to_instrument_out(spec: InstrumentSpec) -> InstrumentOut:
    return InstrumentOut(**spec.model_dump(exclude={"provider_id", "preload_years"}))


def list_instruments(q: str | None = None, asset_class: str | None = None) -> list[InstrumentOut]:
    needle = (q or "").strip().upper()
    items = [
        spec
        for spec in all_instruments()
        if spec.enabled
        and (not asset_class or spec.asset_class == asset_class)
        and (not needle or needle in spec.symbol)
    ]
    return [to_instrument_out(spec) for spec in items]


def enabled_instrument(symbol: str) -> InstrumentSpec:
    spec = get_instrument(symbol)
    if spec is None or not spec.enabled:
        raise BacktestError("instrument_not_supported", f"{symbol or 'That instrument'} is not available for charts yet.")
    return spec


def candles_for_user(
    db: Session,
    user: User,
    *,
    symbol: str,
    timeframe: str,
    start: str | int,
    end: str | int,
    until: str | int | None = None,
    limit: int | None = None,
) -> CandlesOut:
    check_candle_rate(user.id)
    if timeframe not in TIMEFRAME_MINUTES:
        raise BacktestError("invalid_request", f"timeframe must be one of {', '.join(TIMEFRAME_MINUTES)}.")
    spec = enabled_instrument(symbol)
    start_ms, end_ms = parse_time(start, "start"), parse_time(end, "end")
    until_ms = parse_time(until, "until")
    if start_ms is None or end_ms is None or end_ms <= start_ms:
        raise BacktestError("invalid_request", "start and end are required and end must be after start.")
    step = timeframe_ms(timeframe)
    cap = min(limit or settings.candle_max_bars_per_request, settings.candle_max_bars_per_request)
    if limit is not None and limit < 1:
        raise BacktestError("invalid_request", "limit must be positive.")
    start_ms = floor_to(start_ms, step)
    fetch_end = min(ceil_to(end_ms, step), start_ms + cap * step)
    if until_ms is not None:
        fetch_end = min(fetch_end, ceil_to(until_ms, step))
    fetch_end = min(fetch_end, floor_to(int(time.time() * 1000), MINUTE_MS))
    if fetch_end > start_ms:
        ensured = ensure_candles(db, spec, start_ms, fetch_end, owner_user_id=user.id)
        if not ensured.ready:
            raise BacktestError("data_preparing", "Market data is being prepared.", job_id=ensured.job_id, retry_after_s=2)
    window = get_candles(db, spec, timeframe, start_ms, end_ms, until_ms=until_ms, max_bars=cap)
    c = window.candles
    return CandlesOut(
        symbol=spec.symbol,
        timeframe=timeframe,
        t=c.ts.tolist(),
        o=c.open.tolist(),
        h=c.high.tolist(),
        l=c.low.tolist(),
        c=c.close.tolist(),
        v=c.volume.tolist(),
        earliest_ms=window.earliest_ms,
        has_more_before=window.has_more_before,
        has_more_after=window.has_more_after,
        complete_until_ms=window.complete_until_ms,
    )


_interest_limiter = SlidingWindowRateLimiter(max_calls=30, window_seconds=3600)


def record_symbol_interest(db: Session, user: User, broker: str | None, raw_symbol: str) -> None:
    if not _interest_limiter.allow(f"interest:{user.id}"):
        raise BacktestError("rate_limited", "You've sent a lot of requests. Try again later.", retry_after_s=600)
    record_interest(db, broker, raw_symbol)
    db.commit()


def job_for_user(db: Session, user: User, job_id: uuid.UUID) -> DataJobOut:
    job = db.get(Job, job_id)
    visible = job is not None and (job.lane != "backtest" or job.owner_user_id == user.id)
    if not visible:
        raise not_found("Job")
    return DataJobOut(
        id=str(job.id),
        type=job.type,
        status=job.status,
        progress=job.progress,
        progress_message=job.progress_message,
        error_code=job.error_code,
        error_message=job.error_message if job.status == "failed" else None,
        created_at=job.created_at,
        finished_at=job.finished_at,
    )
