"""Per-user caps for manual sessions and automated runs."""

from __future__ import annotations

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.backtest import BacktestSession, UsageCounter
from app.models.user import User
from app.services.backtest.errors import BacktestError


def _counter(db: Session, user: User, day: date) -> UsageCounter:
    row = db.get(UsageCounter, (user.id, day))
    if row is None:
        row = UsageCounter(user_id=user.id, day=day, backtest_runs=0, manual_sessions=0)
        db.add(row)
        db.flush()
    return row


def assert_session_quota(db: Session, user: User) -> None:
    total = db.scalar(select(func.count()).select_from(BacktestSession).where(BacktestSession.user_id == user.id)) or 0
    if total >= settings.backtest_max_sessions:
        raise BacktestError("quota_exceeded", f"You can keep up to {settings.backtest_max_sessions} manual sessions.")
    counter = _counter(db, user, date.today())
    if counter.manual_sessions >= settings.backtest_runs_per_day:
        raise BacktestError("quota_exceeded", "You've started enough sessions for today.")


def record_session_created(db: Session, user: User) -> None:
    counter = _counter(db, user, date.today())
    counter.manual_sessions += 1


def assert_run_quota(db: Session, user: User, *, running: int) -> None:
    if running >= settings.backtest_max_concurrent_per_user:
        raise BacktestError("quota_exceeded", "You already have a backtest running.")
    counter = _counter(db, user, date.today())
    if counter.backtest_runs >= settings.backtest_runs_per_day:
        raise BacktestError("quota_exceeded", "You've used today's backtest runs.")


def record_run_created(db: Session, user: User) -> None:
    counter = _counter(db, user, date.today())
    counter.backtest_runs += 1
