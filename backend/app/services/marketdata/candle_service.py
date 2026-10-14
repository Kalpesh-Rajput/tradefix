"""The only module the rest of the app uses to get candles (backtesting/02 section 9, D-017).

`ensure_candles` never blocks a request thread for long: Dukascopy gaps always become jobs; small Binance
gaps are filled inline on a bounded pool (at most INLINE_FETCH_MAX_CONCURRENT at once) and the caller
waits at most INLINE_FETCH_TIMEOUT_S. Everything else gets a deduplicated job and a "preparing" answer.
"""

from __future__ import annotations

import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from dataclasses import dataclass, field
from typing import Callable

import numpy as np
from sqlalchemy.orm import Session

from app.core.config import settings
from app.services.backtest.errors import BacktestError
from app.services.marketdata.aggregation import aggregate, ceil_to, floor_to, timeframe_ms
from app.services.marketdata.cache import CacheKey, CandleCache, candle_cache
from app.services.marketdata.candles import MINUTE_MS, Candles
from app.services.marketdata.coverage import Range, covered_ranges, find_gaps, subtract_ranges
from app.services.marketdata.ingest_jobs import ProviderFactory, default_provider, enqueue_ingest, fill_gaps
from app.services.marketdata.providers import ProviderError
from app.services.marketdata.registry import InstrumentSpec
from app.services.marketdata.store import CandleStore, get_store

logger = logging.getLogger(__name__)

SessionFactory = Callable[[], Session]

_inline_slots = threading.BoundedSemaphore(settings.inline_fetch_max_concurrent)
_inline_pool = ThreadPoolExecutor(max_workers=settings.inline_fetch_max_concurrent, thread_name_prefix="inline-fill")


@dataclass(frozen=True)
class EnsureResult:
    status: str
    job_id: str | None = None
    gaps: list[Range] = field(default_factory=list)
    via: str = "stored"

    @property
    def ready(self) -> bool:
        return self.status == "ready"


def _default_sessions() -> Session:
    from app.core.db import SessionLocal

    return SessionLocal()


def _enqueue(db: Session, spec: InstrumentSpec, gaps: list[Range], reason: str, owner_user_id) -> EnsureResult:
    enqueued = enqueue_ingest(db, spec, gaps[0][0], gaps[-1][1], owner_user_id=owner_user_id)
    db.commit()
    logger.info("candles preparing", extra={"symbol": spec.symbol, "reason": reason, "job_id": str(enqueued.job.id)})
    return EnsureResult("preparing", str(enqueued.job.id), gaps, reason)


def _inline_fill(session_factory: SessionFactory, spec: InstrumentSpec, gaps: list[Range], store: CandleStore, provider_factory: ProviderFactory) -> dict:
    try:
        db = session_factory()
        try:
            return fill_gaps(db, spec, gaps, store=store, provider=provider_factory(spec.source))
        finally:
            db.close()
    finally:
        _inline_slots.release()


def ensure_candles(
    db: Session,
    spec: InstrumentSpec,
    start_ms: int,
    end_ms: int,
    *,
    store: CandleStore | None = None,
    provider_factory: ProviderFactory = default_provider,
    session_factory: SessionFactory = _default_sessions,
    owner_user_id=None,
) -> EnsureResult:
    gaps = find_gaps(db, spec.symbol, spec.source, start_ms, end_ms)
    if not gaps:
        return EnsureResult("ready")
    missing_minutes = sum(b - a for a, b in gaps) // MINUTE_MS
    if spec.source != "binance":
        return _enqueue(db, spec, gaps, "job_only_source", owner_user_id)
    if missing_minutes > settings.inline_fetch_max_gap_minutes:
        return _enqueue(db, spec, gaps, "gap_too_large", owner_user_id)
    if not _inline_slots.acquire(blocking=False):
        return _enqueue(db, spec, gaps, "inline_cap", owner_user_id)
    started = time.monotonic()
    try:
        future = _inline_pool.submit(_inline_fill, session_factory, spec, gaps, store or get_store(), provider_factory)
    except Exception:
        _inline_slots.release()
        raise
    try:
        future.result(timeout=settings.inline_fetch_timeout_s)
    except FutureTimeout:
        return _enqueue(db, spec, gaps, "inline_timeout", owner_user_id)
    except ProviderError as exc:
        if not exc.retryable:
            raise BacktestError("data_unavailable", "Market data is temporarily unavailable.", details={"reason": exc.code}) from exc
        return _enqueue(db, spec, gaps, f"inline_failed:{exc.code}", owner_user_id)
    except Exception:
        logger.exception("inline candle fill failed; handing over to the worker", extra={"symbol": spec.symbol})
        return _enqueue(db, spec, gaps, "inline_error", owner_user_id)
    db.expire_all()
    logger.info("candles filled inline", extra={"symbol": spec.symbol, "minutes": missing_minutes, "ms": int((time.monotonic() - started) * 1000)})
    return EnsureResult("ready", via="inline")


@dataclass(frozen=True)
class CandleWindow:
    symbol: str
    timeframe: str
    candles: Candles
    has_more_before: bool
    has_more_after: bool
    earliest_ms: int | None
    complete_until_ms: int


def _inside_coverage(starts: np.ndarray, step: int, covered: list[Range]) -> np.ndarray:
    mask = np.zeros(starts.shape[0], dtype=bool)
    for a, b in covered:
        mask |= (starts >= a) & (starts + step <= b)
    return mask


def get_candles(
    db: Session,
    spec: InstrumentSpec,
    timeframe: str,
    start_ms: int,
    end_ms: int,
    *,
    until_ms: int | None = None,
    max_bars: int | None = None,
    store: CandleStore | None = None,
    cache: CandleCache | None = None,
    now_ms: int | None = None,
) -> CandleWindow:
    """Candles whose buckets are fully closed (before `until`, or now) and fully covered."""
    step = timeframe_ms(timeframe)
    cap = min(max_bars or settings.candle_max_bars_per_request, settings.candle_max_bars_per_request)
    start, end = floor_to(start_ms, step), ceil_to(end_ms, step)
    if end <= start:
        raise BacktestError("invalid_request", "The end must be after the start.")
    now = now_ms if now_ms is not None else int(time.time() * 1000)
    cutoff = min(until_ms if until_ms is not None else now, now)
    store = store or get_store()
    cache = candle_cache if cache is None else cache
    covered = covered_ranges(db, spec.symbol, spec.source)
    query_end = min(end, start + cap * step)
    key = CacheKey(spec.source, spec.symbol, timeframe, start, query_end)
    buckets = cache.get(key)
    if buckets is None:
        buckets = aggregate(store, spec.source, spec.symbol, timeframe, start, query_end)
        if not subtract_ranges((start, query_end), covered):
            cache.put(key, buckets)
    keep = (buckets.ts + step <= cutoff) & _inside_coverage(buckets.ts, step, covered)
    window = buckets.take(keep)
    earliest = covered[0][0] if covered else None
    latest = covered[-1][1] if covered else None
    return CandleWindow(
        symbol=spec.symbol,
        timeframe=timeframe,
        candles=window,
        has_more_before=earliest is not None and earliest < start,
        has_more_after=query_end < end or (latest is not None and latest > query_end and cutoff > query_end),
        earliest_ms=earliest,
        complete_until_ms=floor_to(min(cutoff, latest or start), step),
    )
