"""Database job queue for ingestion and backtests (backtesting/02 section 10, D-002).

- `enqueue` dedups on `dedup_key` while a job is queued or running (partial unique index).
- `claim` takes the oldest runnable job of a lane with free capacity using `FOR UPDATE SKIP LOCKED`;
  a per-lane transaction advisory lock makes the capacity check and the claim atomic.
- Failures retry with capped exponential backoff and jitter until `max_attempts`.
- `recover_expired` returns jobs whose worker lock lapsed (crash) to the queue.
- Cancellation: queued jobs cancel at once; running jobs see `cancel_requested` between chunks.
"""

from __future__ import annotations

import logging
import random
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from sqlalchemy import func, select, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.job import ACTIVE_JOB_STATUSES, Job

logger = logging.getLogger(__name__)

LANES = ("binance", "dukascopy", "backtest")
TERMINAL_STATUSES = ("succeeded", "failed", "cancelled")


class JobCancelled(Exception):
    pass


class JobDeferred(Exception):
    """The handler released the job. Requeue it later without using an attempt or a lane slot."""

    def __init__(self, delay_s: float) -> None:
        super().__init__(delay_s)
        self.delay_s = delay_s


@dataclass(frozen=True)
class Enqueued:
    job: Job
    created: bool


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def lane_limits() -> dict[str, int]:
    return {
        "binance": settings.jobs_max_concurrent_binance,
        "dukascopy": settings.jobs_max_concurrent_dukascopy,
        "backtest": settings.jobs_max_concurrent_backtest,
    }


def backoff_seconds(attempt: int, *, rng: random.Random | None = None) -> float:
    """Capped exponential backoff with jitter in [50%, 100%] of the step for attempt 1, 2, 3..."""
    step = min(settings.job_backoff_max_seconds, settings.job_backoff_base_seconds * 2 ** max(0, attempt - 1))
    return step * (0.5 + 0.5 * (rng or random).random())


def enqueue(
    db: Session,
    *,
    type: str,
    lane: str,
    payload: dict[str, Any],
    dedup_key: str | None = None,
    owner_user_id: uuid.UUID | None = None,
    max_attempts: int | None = None,
    run_at: datetime | None = None,
) -> Enqueued:
    if lane not in LANES:
        raise ValueError(f"unknown lane {lane}")
    values = {
        "id": uuid.uuid4(),
        "type": type,
        "lane": lane,
        "status": "queued",
        "payload": payload,
        "dedup_key": dedup_key,
        "owner_user_id": owner_user_id,
        "max_attempts": max_attempts or settings.job_max_attempts,
        "next_run_at": run_at or utcnow(),
        "progress": 0,
        "attempts": 0,
        "cancel_requested": False,
    }
    stmt = insert(Job.__table__).values(**values)
    if dedup_key:
        stmt = stmt.on_conflict_do_nothing(
            index_elements=["dedup_key"],
            index_where=text("status IN ('queued', 'running') AND dedup_key IS NOT NULL"),
        )
    inserted = db.execute(stmt.returning(Job.__table__.c.id)).scalar()
    if inserted is not None:
        db.flush()
        job = db.get(Job, inserted)
        logger.info("job enqueued", extra={"job_id": str(inserted), "type": type, "lane": lane, "dedup_key": dedup_key})
        return Enqueued(job, True)
    existing = db.scalar(select(Job).where(Job.dedup_key == dedup_key, Job.status.in_(ACTIVE_JOB_STATUSES)))
    if existing is None:
        return enqueue(db, type=type, lane=lane, payload=payload, dedup_key=dedup_key, owner_user_id=owner_user_id,
                       max_attempts=max_attempts, run_at=run_at)
    return Enqueued(existing, False)


def active_job(db: Session, dedup_key: str) -> Job | None:
    return db.scalar(select(Job).where(Job.dedup_key == dedup_key, Job.status.in_(ACTIVE_JOB_STATUSES)))


def running_counts(db: Session) -> dict[str, int]:
    rows = db.execute(select(Job.lane, func.count()).where(Job.status == "running").group_by(Job.lane)).all()
    return {lane: int(count) for lane, count in rows}


def claim(db: Session, worker_id: str, *, lanes: tuple[str, ...] = LANES, now: datetime | None = None) -> Job | None:
    """Claim one runnable job from the first lane (in order) that has capacity. Commits."""
    now = now or utcnow()
    limits = lane_limits()
    for lane in lanes:
        db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:k))"), {"k": f"jobs:lane:{lane}"})
        running = db.scalar(select(func.count()).select_from(Job).where(Job.lane == lane, Job.status == "running")) or 0
        if running >= limits.get(lane, 1):
            db.commit()
            continue
        job = db.scalar(
            select(Job)
            .where(Job.lane == lane, Job.status == "queued", Job.next_run_at <= now)
            .order_by(Job.next_run_at, Job.created_at)
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        if job is None:
            db.commit()
            continue
        job.status = "running"
        job.attempts += 1
        job.locked_by = worker_id
        job.locked_until = now + timedelta(seconds=settings.job_lock_seconds)
        job.started_at = job.started_at or now
        job.error_code = None
        db.commit()
        logger.info("job claimed", extra={"job_id": str(job.id), "type": job.type, "attempt": job.attempts, "worker": worker_id})
        return job
    return None


def extend_lock(db: Session, job_id: uuid.UUID, worker_id: str) -> bool:
    result = db.execute(
        update(Job)
        .where(Job.id == job_id, Job.status == "running", Job.locked_by == worker_id)
        .values(locked_until=utcnow() + timedelta(seconds=settings.job_lock_seconds))
    )
    db.commit()
    return bool(result.rowcount)


def set_progress(db: Session, job_id: uuid.UUID, worker_id: str, percent: int, message: str | None = None) -> bool:
    """Record progress and extend the lock. Returns True when cancellation was requested."""
    db.execute(
        update(Job)
        .where(Job.id == job_id, Job.locked_by == worker_id)
        .values(
            progress=max(0, min(100, int(percent))),
            progress_message=(message or None) and message[:300],
            locked_until=utcnow() + timedelta(seconds=settings.job_lock_seconds),
        )
    )
    db.commit()
    return bool(db.scalar(select(Job.cancel_requested).where(Job.id == job_id)))


def complete(db: Session, job: Job, result: dict[str, Any] | None = None) -> None:
    job.status = "succeeded"
    job.progress = 100
    job.result = result or {}
    job.finished_at = utcnow()
    job.locked_by = job.locked_until = None
    job.error_code = job.error_message = None
    db.commit()
    logger.info("job succeeded", extra={"job_id": str(job.id), "type": job.type, "attempts": job.attempts})


def fail(
    db: Session,
    job: Job,
    code: str,
    message: str,
    *,
    retryable: bool = True,
    retry_after_s: float | None = None,
    rng: random.Random | None = None,
) -> None:
    job.error_code = code[:64]
    job.error_message = message[:2000]
    job.locked_by = job.locked_until = None
    if retryable and job.attempts < job.max_attempts and not job.cancel_requested:
        delay = max(backoff_seconds(job.attempts, rng=rng), retry_after_s or 0)
        job.status = "queued"
        job.next_run_at = utcnow() + timedelta(seconds=delay)
        logger.warning("job retry scheduled", extra={"job_id": str(job.id), "code": code, "attempt": job.attempts, "delay_s": round(delay, 1)})
    else:
        job.status = "failed"
        job.finished_at = utcnow()
        logger.error("job failed", extra={"job_id": str(job.id), "type": job.type, "code": code, "attempts": job.attempts})
    db.commit()


def defer(db: Session, job: Job, delay_s: float) -> None:
    """Put a running job back on the queue. The claim's attempt is undone so waiting does not burn retries."""
    job.status = "queued"
    job.next_run_at = utcnow() + timedelta(seconds=max(0.0, delay_s))
    job.attempts = max(0, job.attempts - 1)
    job.locked_by = job.locked_until = None
    db.commit()
    logger.info("job deferred", extra={"job_id": str(job.id), "type": job.type, "delay_s": delay_s})


def mark_cancelled(db: Session, job: Job) -> None:
    job.status = "cancelled"
    job.finished_at = utcnow()
    job.locked_by = job.locked_until = None
    db.commit()
    logger.info("job cancelled", extra={"job_id": str(job.id), "type": job.type})


def request_cancel(db: Session, job_id: uuid.UUID, *, owner_user_id: uuid.UUID | None = None) -> Job | None:
    stmt = select(Job).where(Job.id == job_id).with_for_update()
    if owner_user_id is not None:
        stmt = stmt.where(Job.owner_user_id == owner_user_id)
    job = db.scalar(stmt)
    if job is None:
        return None
    if job.status == "queued":
        job.status = "cancelled"
        job.finished_at = utcnow()
    elif job.status == "running":
        job.cancel_requested = True
    db.commit()
    return job


def retry_failed(db: Session, job_id: uuid.UUID) -> Job | None:
    """Admin retry: requeue a failed job with a fresh attempt budget (unless an equal active job exists)."""
    job = db.get(Job, job_id)
    if job is None or job.status != "failed":
        return job
    if job.dedup_key and active_job(db, job.dedup_key) is not None:
        return active_job(db, job.dedup_key)
    job.status = "queued"
    job.attempts = 0
    job.next_run_at = utcnow()
    job.finished_at = None
    job.cancel_requested = False
    db.commit()
    return job


def recover_expired(db: Session, now: datetime | None = None) -> int:
    """Requeue running jobs whose lock expired (worker crash); fail those out of attempts."""
    now = now or utcnow()
    stale = list(
        db.scalars(
            select(Job).where(Job.status == "running", Job.locked_until < now).with_for_update(skip_locked=True)
        )
    )
    for job in stale:
        job.locked_by = job.locked_until = None
        if job.cancel_requested:
            job.status, job.finished_at = "cancelled", now
        elif job.attempts >= job.max_attempts:
            job.status, job.finished_at = "failed", now
            job.error_code, job.error_message = "lock_expired", "The worker stopped while running this job."
        else:
            job.status, job.next_run_at = "queued", now
        logger.warning("expired job lock recovered", extra={"job_id": str(job.id), "status": job.status})
    db.commit()
    return len(stale)


Handler = Callable[["JobContext"], dict[str, Any] | None]
HANDLERS: dict[str, Handler] = {}


def register_handler(job_type: str) -> Callable[[Handler], Handler]:
    def decorator(fn: Handler) -> Handler:
        HANDLERS[job_type] = fn
        return fn

    return decorator


@dataclass
class JobContext:
    db: Session
    job: Job
    worker_id: str

    @property
    def payload(self) -> dict[str, Any]:
        return self.job.payload or {}

    def progress(self, percent: int, message: str | None = None) -> None:
        """Report progress; raises JobCancelled when the user asked to cancel (checked between chunks)."""
        if set_progress(self.db, self.job.id, self.worker_id, percent, message):
            raise JobCancelled()

    def check_cancel(self) -> None:
        self.db.expire(self.job, ["cancel_requested"])
        if self.job.cancel_requested:
            raise JobCancelled()
