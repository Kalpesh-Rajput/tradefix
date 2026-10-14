"""Queue candle downloads for new or updated journal trades (02 section 11). Never fails a trade save."""

from __future__ import annotations

import logging
import time
import uuid
from collections import defaultdict
from typing import Callable, Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.trade import Trade
from app.services.live_trades import LIVE_TRADE_FILTER
from app.services.marketdata.coverage import Range, find_gaps, merge_ranges
from app.services.marketdata.ingest_jobs import enqueue_ingest
from app.services.marketdata.registry import InstrumentSpec
from app.services.marketdata.replay_service import default_timeframe, holding_ms, journal_descriptor, replay_window
from app.services.marketdata.resolver import resolve_symbol

logger = logging.getLogger(__name__)

MAX_TRADES_PER_CALL = 2000


def _default_sessions() -> Session:
    from app.core.db import SessionLocal

    return SessionLocal()


def plan_windows(db: Session, trades: Iterable[Trade], now_ms: int) -> dict[str, tuple[InstrumentSpec, list[Range]]]:
    """Merged 1m replay windows per enabled instrument; unresolved symbols are recorded, not fetched."""
    windows: dict[str, list[Range]] = defaultdict(list)
    specs: dict[str, InstrumentSpec] = {}
    for trade in trades:
        descriptor = journal_descriptor(db, trade)
        resolution = resolve_symbol(db, descriptor.broker, descriptor.raw_symbol)
        spec = resolution.instrument
        if spec is None or not spec.enabled:
            continue
        timeframe = default_timeframe(holding_ms(descriptor, now_ms))
        start, end = replay_window(descriptor.entry_ms, descriptor.exit_ms, timeframe, now_ms)
        if end > start:
            specs[spec.symbol] = spec
            windows[spec.symbol].append((start, end))
    return {symbol: (specs[symbol], merge_ranges(ranges)) for symbol, ranges in windows.items()}


def prefetch_for_trades(
    trade_ids: Iterable[uuid.UUID],
    *,
    session_factory: Callable[[], Session] | None = None,
    now_ms: int | None = None,
) -> list[str]:
    """Run after the caller's commit. Returns the job ids touched; logs and swallows every failure."""
    ids = list(dict.fromkeys(trade_ids))[:MAX_TRADES_PER_CALL]
    if not ids:
        return []
    jobs: list[str] = []
    try:
        db = (session_factory or _default_sessions)()
        try:
            trades = db.scalars(select(Trade).where(Trade.id.in_(ids), LIVE_TRADE_FILTER, Trade.is_deleted.is_(False))).all()
            now = now_ms if now_ms is not None else int(time.time() * 1000)
            for spec, ranges in plan_windows(db, trades, now).values():
                for start, end in ranges:
                    gaps = find_gaps(db, spec.symbol, spec.source, start, end)
                    if gaps:
                        jobs.append(str(enqueue_ingest(db, spec, gaps[0][0], gaps[-1][1]).job.id))
            db.commit()
        finally:
            db.close()
    except Exception:
        logger.exception("candle prefetch failed; trades are saved", extra={"trades": len(ids)})
        return []
    if jobs:
        logger.info("candle prefetch queued", extra={"trades": len(ids), "jobs": len(jobs)})
    return jobs
