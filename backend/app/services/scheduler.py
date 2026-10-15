"""In-process APScheduler jobs. No Redis/Celery needed for local dev -- jobs
run inside the same FastAPI process and iterate over all users.
"""

import logging

from apscheduler.schedulers.background import BackgroundScheduler
from app.core.db import SessionLocal

logger = logging.getLogger("tradefix.scheduler")

scheduler = BackgroundScheduler()


def sweep_agent_runs() -> None:
    from app.services.ai.agents.executor import sweep_stale_runs

    db = SessionLocal()
    try:
        sweep_stale_runs(db)
    except Exception:  # noqa: BLE001
        logger.exception("Agent run sweep failed")
    finally:
        db.close()


def run_progress_reminders() -> None:
    from app.services.progress_notifications import run_streak_reminders

    db = SessionLocal()
    try:
        run_streak_reminders(db)
    except Exception:  # noqa: BLE001
        logger.exception("Progress Tracker reminders failed")
    finally:
        db.close()


def enqueue_broker_sync() -> None:
    from app.services.sync.engine import enqueue_due, recover_stale

    db = SessionLocal()
    try:
        recover_stale(db)
        enqueue_due(db)
    except Exception:
        logger.exception("Broker sync enqueue failed")
    finally:
        db.close()


def enqueue_broker_reconciliation() -> None:
    from app.services.sync.engine import enqueue_reconciliation, enqueue_token_refresh

    db = SessionLocal()
    try:
        enqueue_reconciliation(db)
        enqueue_token_refresh(db)
    except Exception:
        logger.exception("Broker reconciliation enqueue failed")
    finally:
        db.close()


_scheduler_lock = None


def enqueue_market_topup() -> None:
    from app.services.marketdata.topup import enqueue_topup

    db = SessionLocal()
    try:
        enqueue_topup(db)
    except Exception:
        logger.exception("top-up enqueue failed")
    finally:
        db.close()


def enqueue_market_crosscheck() -> None:
    from app.services.marketdata.topup import enqueue_crosscheck

    db = SessionLocal()
    try:
        enqueue_crosscheck(db)
    except Exception:
        logger.exception("cross-check enqueue failed")
    finally:
        db.close()


def start_scheduler() -> bool:
    """Start this process's scheduler only when it wins the advisory lock (D-019)."""
    global _scheduler_lock
    if scheduler.running:
        return True
    from app.core.config import settings
    from app.services.jobs.locks import AdvisoryLock

    lock = AdvisoryLock(settings.scheduler_lock_key)
    if not lock.try_acquire():
        logger.info("scheduler lock is already held")
        return False
    _scheduler_lock = lock
    scheduler.add_job(sweep_agent_runs, "interval", minutes=5, id="agent_run_sweep", replace_existing=True)
    scheduler.add_job(run_progress_reminders, "cron", minute=0, id="progress_reminders", replace_existing=True)
    scheduler.add_job(enqueue_broker_sync, "interval", minutes=5, id="broker_sync_enqueue", replace_existing=True)
    scheduler.add_job(
        enqueue_broker_reconciliation, "interval", minutes=10, id="broker_reconcile_enqueue", replace_existing=True
    )
    scheduler.add_job(
        enqueue_market_topup,
        "cron",
        hour=settings.topup_utc_hour,
        minute=settings.topup_utc_minute,
        id="market_topup",
        replace_existing=True,
    )
    scheduler.add_job(
        enqueue_market_crosscheck,
        "cron",
        hour=settings.topup_utc_hour,
        minute=(settings.topup_utc_minute + 20) % 60,
        id="market_crosscheck",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("scheduler started", extra={"lock_key": settings.scheduler_lock_key})
    return True


def shutdown_scheduler() -> None:
    global _scheduler_lock
    if scheduler.running:
        scheduler.shutdown(wait=False)
    if _scheduler_lock is not None:
        _scheduler_lock.release()
        _scheduler_lock = None
