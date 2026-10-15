"""Market-data and backtest job worker (backtesting/02 section 10, D-019).

Run exactly one: `python -m app.workers.market_worker` (from backend/), or set MARKET_WORKER_IN_PROCESS
to start it as a thread inside the API. Either way it holds `pg_try_advisory_lock(MARKET_WORKER_LOCK_KEY)`
on a dedicated connection; a second instance logs and idles until the lock frees up.
"""

from __future__ import annotations

import logging
import os
import socket
import threading
import uuid
from concurrent.futures import Future, ThreadPoolExecutor
from typing import Callable

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.job import Job, WorkerHeartbeat
from app.services.jobs import queue
from app.services.jobs.locks import AdvisoryLock
from app.services.marketdata.providers.base import ProviderError

logger = logging.getLogger("tradefix.market_worker")

HEARTBEAT_NAME = "market_worker"
HANDLER_MODULES: tuple[str, ...] = (
    "app.services.marketdata.ingest_jobs",
    "app.services.marketdata.topup",
    "app.services.backtest.runs_service",
)
_started = False


def _load_handlers() -> None:
    import importlib

    for module in HANDLER_MODULES:
        importlib.import_module(module)


def write_heartbeat(db: Session, instance: str, info: dict) -> None:
    table = WorkerHeartbeat.__table__
    stmt = insert(table).values(name=HEARTBEAT_NAME, instance=instance, info=info, last_seen=queue.utcnow())
    db.execute(
        stmt.on_conflict_do_update(
            index_elements=["name"], set_={"instance": instance, "info": info, "last_seen": queue.utcnow()}
        )
    )
    db.commit()


def execute_job(db: Session, job: Job, worker_id: str) -> str:
    """Run one claimed job's handler and record the outcome. Returns the final status."""
    handler = queue.HANDLERS.get(job.type)
    if handler is None:
        queue.fail(db, job, "unknown_job_type", f"No handler for job type {job.type}", retryable=False)
        return job.status
    ctx = queue.JobContext(db=db, job=job, worker_id=worker_id)
    try:
        ctx.check_cancel()
        result = handler(ctx)
    except queue.JobCancelled:
        db.rollback()
        queue.mark_cancelled(db, db.get(Job, job.id))
    except queue.JobDeferred as exc:
        queue.defer(db, db.get(Job, job.id), exc.delay_s)
    except ProviderError as exc:
        db.rollback()
        queue.fail(db, db.get(Job, job.id), exc.code, exc.message, retryable=exc.retryable, retry_after_s=exc.retry_after_s)
    except Exception as exc:
        db.rollback()
        logger.exception("job handler crashed", extra={"job_id": str(job.id), "type": job.type})
        code = getattr(exc, "code", "internal_error")
        queue.fail(db, db.get(Job, job.id), str(code), str(exc) or exc.__class__.__name__,
                   retryable=getattr(exc, "retryable", True))
    else:
        queue.complete(db, db.get(Job, job.id), result)
    return db.get(Job, job.id).status


class MarketWorker:
    def __init__(
        self,
        *,
        session_factory: Callable[[], Session] | None = None,
        lock: AdvisoryLock | None = None,
        poll_seconds: float | None = None,
    ) -> None:
        if session_factory is None:
            from app.core.db import SessionLocal

            session_factory = SessionLocal
        self.session_factory = session_factory
        self.lock = lock or AdvisoryLock(settings.market_worker_lock_key)
        self.poll_seconds = poll_seconds or settings.market_worker_poll_seconds
        self.worker_id = f"{socket.gethostname()}:{os.getpid()}:{uuid.uuid4().hex[:6]}"
        self.stop_event = threading.Event()
        self.slots = max(1, sum(queue.lane_limits().values()))
        self.pool = ThreadPoolExecutor(max_workers=self.slots, thread_name_prefix="market-job")
        self.running: dict[uuid.UUID, Future] = {}
        self._running_lock = threading.Lock()
        _load_handlers()

    def _run_claimed(self, job_id: uuid.UUID) -> None:
        db = self.session_factory()
        try:
            job = db.get(Job, job_id)
            if job is not None:
                execute_job(db, job, self.worker_id)
        except Exception:
            logger.exception("job execution wrapper failed", extra={"job_id": str(job_id)})
        finally:
            db.close()
            with self._running_lock:
                self.running.pop(job_id, None)

    def tick(self) -> int:
        """One scheduling pass: heartbeat, recover expired locks, extend own locks, claim into free slots."""
        db = self.session_factory()
        claimed = 0
        try:
            with self._running_lock:
                active = list(self.running)
            write_heartbeat(db, self.worker_id, {"running": len(active), "pid": os.getpid()})
            queue.recover_expired(db)
            for job_id in active:
                queue.extend_lock(db, job_id, self.worker_id)
            capacity = self.slots - len(active)
            while capacity > 0:
                job = queue.claim(db, self.worker_id)
                if job is None:
                    break
                # Reserve the slot before submit. A fast (or inline) job can finish and remove the
                # placeholder before this method stores the future; storing it under the lock would deadlock.
                with self._running_lock:
                    self.running[job.id] = None
                future = self.pool.submit(self._run_claimed, job.id)
                with self._running_lock:
                    if job.id in self.running:
                        self.running[job.id] = future
                claimed += 1
                capacity -= 1
        finally:
            db.close()
        return claimed

    def run_forever(self) -> None:
        announced = False
        while not self.stop_event.is_set():
            if not self.lock.held or not self.lock.alive():
                if not self.lock.try_acquire():
                    if not announced:
                        logger.warning("another market worker holds the lock; idling", extra={"key": self.lock.key})
                        announced = True
                    self.stop_event.wait(self.poll_seconds * 5)
                    continue
                logger.info("market worker started", extra={"worker": self.worker_id})
                announced = False
            try:
                self.tick()
            except Exception:
                logger.exception("market worker tick failed")
            self.stop_event.wait(self.poll_seconds)
        self.shutdown()

    def shutdown(self) -> None:
        self.stop_event.set()
        self.pool.shutdown(wait=True, cancel_futures=False)
        self.lock.release()


def start_in_process() -> MarketWorker | None:
    global _started
    if _started:
        return None
    _started = True
    worker = MarketWorker()
    threading.Thread(target=worker.run_forever, name="market-worker", daemon=True).start()
    return worker


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    MarketWorker().run_forever()
