"""Permissioned writes. Only the executor calls this, and only for scopes the template declared."""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.daily_recap import DailyRecap
from app.models.day_note import DayNote
from app.models.day_plan import DayPlan
from app.models.trade import Trade
from app.models.user import User
from app.models.user_notification import UserNotification
from app.services.day_plans_service import get_or_create


def assert_writes(allowed: frozenset[str], requested: set[str]) -> None:
    extra = requested - set(allowed)
    if extra:
        raise PermissionError(f"Agent cannot write {', '.join(sorted(extra))}.")


def write_briefing(db: Session, user: User, account_id: uuid.UUID, day: date, text: str) -> str:
    plan = get_or_create(db, user, account_id, day)
    plan.briefing = text[:8000]
    return "Updated the day plan briefing."


def upsert_ai_note(
    db: Session,
    user_id: uuid.UUID,
    account_id: uuid.UUID,
    day: date,
    kind: str,
    title: str,
    body: str,
    run_id: uuid.UUID,
) -> str:
    existing = db.scalar(
        select(DayNote).where(
            DayNote.user_id == user_id,
            DayNote.account_id == account_id,
            DayNote.date == day,
            DayNote.kind == kind,
        )
    )
    content = f"<p><strong>{title}</strong></p><p>{body}</p><p><a href=\"/agents?run={run_id}\">Open agent run</a></p>"
    if existing:
        existing.content = content
        existing.agent_run_id = run_id
        existing.template_id = kind
        return "Updated the existing AI notebook note."
    db.add(
        DayNote(
            user_id=user_id,
            account_id=account_id,
            date=day,
            kind=kind,
            template_id=kind,
            content=content,
            agent_run_id=run_id,
        )
    )
    return "Saved an AI notebook note."


def write_recap(db: Session, user_id: uuid.UUID, account_id: uuid.UUID, day: date, summary: str, best: str | None, actions: list[str]) -> str:
    recap = db.scalar(
        select(DailyRecap).where(
            DailyRecap.user_id == user_id,
            DailyRecap.account_id == account_id,
            DailyRecap.date == day,
        )
    )
    if recap is None:
        recap = DailyRecap(user_id=user_id, account_id=account_id, date=day)
        db.add(recap)
    recap.reflection = summary[:4000]
    if best:
        recap.best_decision = best[:2000]
    if actions:
        recap.work_on = actions[:8]
    return "Updated the daily recap from this review."


def write_trade_tags(db: Session, user_id: uuid.UUID, trade_id: uuid.UUID, applied: list[str], suggestions: list[dict]) -> None:
    trade = db.get(Trade, uuid.UUID(str(trade_id)))
    if trade is None or trade.user_id != user_id or trade.is_deleted:
        return
    tags = list(trade.setup_tags or [])
    for tag in applied:
        if tag not in tags:
            tags.append(tag)
    trade.setup_tags = tags
    if applied and not trade.setup_tag:
        trade.setup_tag = applied[0]
    trade.ai_tag_suggestions = suggestions


def notify(db: Session, user_id: uuid.UUID, run_id: uuid.UUID, title: str, body: str, href: str) -> None:
    db.add(UserNotification(user_id=user_id, agent_run_id=run_id, title=title, body=body[:500], href=href[:512]))
