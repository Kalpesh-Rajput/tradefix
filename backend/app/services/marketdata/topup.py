"""Nightly top-up and daily cross-check jobs. Dedup keys stop a second enqueue the same day."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.services.jobs import queue
from app.services.marketdata.operations import top_up
from app.services.marketdata.registry import InstrumentSpec, enabled_instruments

logger = logging.getLogger("tradefix.marketdata")

TOPUP_JOB = "candles.topup"
CROSSCHECK_JOB = "candles.crosscheck"


def _day(now: datetime | None = None) -> str:
    return (now or datetime.now(timezone.utc)).date().isoformat()


def enqueue_topup(db: Session, *, day: str | None = None) -> queue.Enqueued:
    day = day or _day()
    enqueued = queue.enqueue(
        db,
        type=TOPUP_JOB,
        lane="binance",
        payload={"day": day},
        dedup_key=f"topup:{day}",
        max_attempts=1,
    )
    db.commit()
    logger.info("scheduled job enqueued", extra={"dedup_key": f"topup:{day}", "job_type": TOPUP_JOB, "job_created": enqueued.created})
    return enqueued


def enqueue_crosscheck(db: Session, *, day: str | None = None) -> queue.Enqueued:
    day = day or _day()
    enqueued = queue.enqueue(
        db,
        type=CROSSCHECK_JOB,
        lane="binance",
        payload={"day": day},
        dedup_key=f"crosscheck:{day}",
        max_attempts=1,
    )
    db.commit()
    logger.info("scheduled job enqueued", extra={"dedup_key": f"crosscheck:{day}", "job_type": CROSSCHECK_JOB, "job_created": enqueued.created})
    return enqueued


def cross_check(db: Session, *, reference=None, specs: list[InstrumentSpec] | None = None) -> list[dict]:
    """Compare a stored close with an injected reference. Missing references are logged, not invented."""
    notes = []
    for spec in specs if specs is not None else enabled_instruments():
        if reference is None:
            notes.append({"symbol": spec.symbol, "status": "no_reference"})
            continue
        stored, other = reference(spec)
        if stored is None or other is None or stored == 0:
            notes.append({"symbol": spec.symbol, "status": "skipped"})
            continue
        delta_pct = abs(stored - other) / abs(stored) * 100
        status = "ok" if delta_pct <= settings.crosscheck_tolerance_pct else "diff"
        notes.append({"symbol": spec.symbol, "status": status, "delta_pct": delta_pct})
    logger.info("cross-check finished", extra={"summary": notes})
    return notes


@queue.register_handler(TOPUP_JOB)
def _run_topup(ctx: queue.JobContext) -> dict:
    summary = top_up(ctx.db)
    logger.info("top-up finished", extra={"job_id": str(ctx.job.id), "day": ctx.payload.get("day"), "summary": summary})
    return {"summary": summary}


@queue.register_handler(CROSSCHECK_JOB)
def _run_crosscheck(ctx: queue.JobContext) -> dict:
    notes = cross_check(ctx.db)
    logger.info("cross-check job finished", extra={"job_id": str(ctx.job.id), "day": ctx.payload.get("day")})
    return {"summary": notes}
