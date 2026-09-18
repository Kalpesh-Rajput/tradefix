"""Reminder delivery abstraction for Progress Tracker.

Email infrastructure is not present in TradeFix yet. This module persists the
intent (enabled + time) and exposes a hook the scheduler can call. Replace
`deliver_streak_reminder` with a mailer later without changing the feature.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.progress_tracker import ProgressTrackerSettings
from app.models.user import User
from app.services.progress_rule_engine import journaling_streak
from app.services.progress_time import now_in_tz, resolve_timezone, today_in_tz
from app.services.progress_tracker_service import (
    _participation_map,
    _versions,
    config_from_snapshot,
    first_effective_date,
)

logger = logging.getLogger("tradefix.progress_notifications")


def deliver_streak_reminder(user: User, local_time: str, streak: int) -> None:
    """Delivery backend. Currently logs only — do not pretend mail was sent."""
    logger.info(
        "Streak reminder due user=%s email=%s local_time=%s streak=%s",
        user.id,
        user.email,
        local_time,
        streak,
    )


def run_streak_reminders(db: Session) -> int:
    rows = list(
        db.scalars(select(ProgressTrackerSettings).where(ProgressTrackerSettings.reminder_enabled.is_(True))).all()
    )
    sent = 0
    utc_now = datetime.now(timezone.utc)
    for settings in rows:
        user = db.get(User, settings.user_id)
        if user is None:
            continue
        tz = resolve_timezone(user.timezone)
        local = now_in_tz(tz)
        if f"{local.hour:02d}:{local.minute:02d}" != settings.reminder_time:
            continue
        today = today_in_tz(tz)
        started = _participation_map(db, user, today, today)
        if today in started:
            continue
        versions = _versions(db, user.id)
        first = first_effective_date(versions)
        current = config_from_snapshot(versions[-1].snapshot) if versions else None
        active = list(current.active_days) if current else list(settings.active_days or [])
        history = _participation_map(db, user, today.replace(year=max(today.year - 2, 1)), today)
        streak = journaling_streak(
            today=today,
            active_days=active,
            participated_dates=set(history.keys()),
            first_effective=first,
        )
        if streak <= 0:
            continue
        deliver_streak_reminder(user, settings.reminder_time, streak)
        sent += 1
        logger.debug("Reminder tick at %s for user %s", utc_now.isoformat(), user.id)
    return sent
