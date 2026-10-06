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


def start_scheduler() -> None:
    if scheduler.running:
        return
    scheduler.add_job(sweep_agent_runs, "interval", minutes=5, id="agent_run_sweep", replace_existing=True)
    scheduler.add_job(run_progress_reminders, "cron", minute=0, id="progress_reminders", replace_existing=True)
    scheduler.add_job(enqueue_broker_sync, "interval", minutes=5, id="broker_sync_enqueue", replace_existing=True)
    scheduler.add_job(
        enqueue_broker_reconciliation, "interval", minutes=10, id="broker_reconcile_enqueue", replace_existing=True
    )
    scheduler.start()


def shutdown_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
