"""Ingestion: fetch missing ranges from a provider and record them, inline or as a `candles.ingest` job."""

from __future__ import annotations

import logging
from typing import Callable

from sqlalchemy.orm import Session

from app.services.jobs import queue
from app.services.jobs.provider_limiter import throttle_for
from app.services.marketdata.cache import candle_cache
from app.services.marketdata.coverage import Range, find_gaps, record_fetch
from app.services.marketdata.providers import Provider, ProviderError, get_provider
from app.services.marketdata.providers.cooldown import raise_if_blocked
from app.services.marketdata.registry import InstrumentSpec, get_instrument
from app.services.marketdata.store import CandleStore, get_store

logger = logging.getLogger(__name__)

JOB_TYPE = "candles.ingest"
DAY_MS = 86_400_000

ProviderFactory = Callable[[str], Provider]


def default_provider(source: str) -> Provider:
    return get_provider(source, throttle=throttle_for(source))


def dedup_key(symbol: str, start_ms: int, end_ms: int) -> str:
    """Day-aligned, so callers asking for nearby windows of the same gap share a job."""
    return f"ingest:{symbol}:{start_ms - start_ms % DAY_MS}:{-(-end_ms // DAY_MS) * DAY_MS}"


def fill_gaps(
    db: Session,
    spec: InstrumentSpec,
    gaps: list[Range],
    *,
    store: CandleStore | None = None,
    provider: Provider | None = None,
    on_chunk: Callable[[int, int, str], None] | None = None,
) -> dict:
    """Fetch every gap chunk by chunk; each chunk is recorded and committed before the next one, so a
    failure keeps earlier chunks and leaves the failed range uncovered."""
    store = store or get_store()
    raise_if_blocked(db, spec.source)
    provider = provider or default_provider(spec.source)
    total = sum(b - a for a, b in gaps) or 1
    done = rows = chunks = 0
    for gap_start, gap_end in gaps:
        for chunk in provider.iter_chunks(spec, gap_start, gap_end):
            result = record_fetch(db, store, spec, chunk.start_ms, chunk.end_ms, chunk.candles)
            db.commit()
            candle_cache.invalidate(spec.source, spec.symbol, chunk.start_ms, chunk.end_ms)
            rows += result.rows_kept
            chunks += 1
            done += chunk.end_ms - chunk.start_ms
            if on_chunk:
                on_chunk(min(99, int(done * 100 / total)), chunks, chunk.via)
    return {"rows": rows, "chunks": chunks}


def enqueue_ingest(db: Session, spec: InstrumentSpec, start_ms: int, end_ms: int, *, owner_user_id=None) -> queue.Enqueued:
    return queue.enqueue(
        db,
        type=JOB_TYPE,
        lane=spec.source,
        payload={"symbol": spec.symbol, "start_ms": start_ms, "end_ms": end_ms},
        dedup_key=dedup_key(spec.symbol, start_ms, end_ms),
        owner_user_id=owner_user_id,
    )


@queue.register_handler(JOB_TYPE)
def handle_ingest(ctx: queue.JobContext, *, store: CandleStore | None = None, provider_factory: ProviderFactory = default_provider) -> dict:
    payload = ctx.payload
    spec = get_instrument(payload.get("symbol", ""))
    if spec is None:
        raise ProviderError("instrument_not_supported", f"unknown instrument {payload.get('symbol')}", retryable=False)
    gaps = find_gaps(ctx.db, spec.symbol, spec.source, int(payload["start_ms"]), int(payload["end_ms"]))
    if not gaps:
        return {"rows": 0, "chunks": 0, "already_covered": True}
    ctx.progress(1, f"{len(gaps)} gap(s) to fetch")

    def report(percent: int, chunks: int, via: str) -> None:
        ctx.progress(percent, f"{chunks} chunk(s) stored ({via})")

    result = fill_gaps(ctx.db, spec, gaps, store=store, provider=provider_factory(spec.source), on_chunk=report)
    logger.info("ingest job done", extra={"job_id": str(ctx.job.id), "symbol": spec.symbol, "job_type": JOB_TYPE, **result})
    return result
