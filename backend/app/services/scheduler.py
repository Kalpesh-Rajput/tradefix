"""In-process APScheduler jobs. No Redis/Celery needed for local dev -- jobs
run inside the same FastAPI process and iterate over all users.
"""

import logging

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import select

from app.core.db import SessionLocal
from app.models.user import User
from app.services.ai.agents import AGENT_REGISTRY

logger = logging.getLogger("tradefix.scheduler")

scheduler = BackgroundScheduler()


def _run_agent_for_all_users(agent_name: str) -> None:
    agent = AGENT_REGISTRY[agent_name]
    db = SessionLocal()
    try:
        users = db.scalars(select(User)).all()
        for user in users:
            try:
                agent.run(db, user.id)
            except Exception:  # noqa: BLE001
                logger.exception("Agent %s failed for user %s", agent_name, user.id)
    finally:
        db.close()


def run_daily_agents() -> None:
    for name in ("morning_brief", "pattern_scout", "risk_contribution", "journal_pulse"):
        _run_agent_for_all_users(name)


def run_weekly_agents() -> None:
    _run_agent_for_all_users("hot_take")


def start_scheduler() -> None:
    if scheduler.running:
        return
    # Daily agents at 8:00 local time (before market open); weekly Hot Take on Sundays.
    scheduler.add_job(run_daily_agents, "cron", hour=8, minute=0, id="daily_agents", replace_existing=True)
    scheduler.add_job(run_weekly_agents, "cron", day_of_week="sun", hour=18, minute=0, id="weekly_agents", replace_existing=True)
    scheduler.start()


def shutdown_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
