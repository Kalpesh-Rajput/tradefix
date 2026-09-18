"""Date-scoped daily planning: game plan, events, and briefing."""

from __future__ import annotations

import logging
import uuid
from datetime import date as date_type

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.account import Account
from app.models.day_plan import DayPlan, DayPlanEvent, DayPlanItem
from app.models.user import User
from app.schemas.day_plan import (
    MAX_EVENTS,
    MAX_ITEMS,
    DayPlanEventCreate,
    DayPlanEventResponse,
    DayPlanEventUpdate,
    DayPlanItemCreate,
    DayPlanItemResponse,
    DayPlanItemUpdate,
    DayPlanResponse,
    DayPlanUpdate,
)
from app.services.progress_rule_engine import ConfigSnapshot
from app.services.progress_time import weekday_key
from app.services.progress_tracker_service import (
    _versions,
    config_from_snapshot,
    touch_progress,
    version_for_date,
)

logger = logging.getLogger(__name__)


def seed_game_plan_labels(config: ConfigSnapshot | None, day: date_type) -> list[str]:
    """Copy the trader's active rules into a starting checklist for that weekday."""
    if not config:
        return []
    labels: list[str] = []
    if config.trading_hours_enabled:
        labels.append(f"Trading hours {config.trading_start_time}–{config.trading_end_time}")
    if config.start_day_enabled:
        labels.append(f"Start my day by {config.start_day_time}")
    if config.stop_loss_required:
        labels.append("Input stop loss for all trades")
    if config.link_playbook_enabled:
        labels.append("Link trades to playbook")
    if config.max_loss_per_trade_enabled:
        labels.append("Net max loss / trade")
    if config.max_loss_per_day_enabled:
        labels.append("Net max loss / day")
    key = weekday_key(day)
    for rule in sorted(config.manual_rules, key=lambda r: (r.sort_order, r.name.lower())):
        schedule = [str(d).lower()[:3] for d in rule.schedule]
        if not schedule or key in schedule:
            labels.append(rule.name.strip()[:160])
    seen: set[str] = set()
    unique: list[str] = []
    for label in labels:
        if not label or label in seen:
            continue
        seen.add(label)
        unique.append(label)
        if len(unique) >= MAX_ITEMS:
            break
    return unique


def _owned_account(db: Session, user: User, account_id: uuid.UUID) -> Account:
    account = db.get(Account, account_id)
    if not account or account.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return account


def _to_response(plan: DayPlan) -> DayPlanResponse:
    items = sorted(plan.items, key=lambda i: (i.sort_order, i.created_at))
    events = sorted(plan.events, key=lambda e: (e.occurs_on, e.sort_order, e.created_at))
    return DayPlanResponse(
        id=plan.id,
        account_id=plan.account_id,
        date=plan.date,
        briefing=plan.briefing or "",
        items=[DayPlanItemResponse.model_validate(item) for item in items],
        events=[DayPlanEventResponse.model_validate(event) for event in events],
        created_at=plan.created_at,
        updated_at=plan.updated_at,
    )


def _load_plan(db: Session, user: User, plan_id: uuid.UUID) -> DayPlan:
    plan = db.scalar(
        select(DayPlan)
        .options(selectinload(DayPlan.items), selectinload(DayPlan.events))
        .where(DayPlan.id == plan_id, DayPlan.user_id == user.id)
    )
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Day plan not found")
    return plan


def _get_item(db: Session, user: User, item_id: uuid.UUID) -> DayPlanItem:
    item = db.get(DayPlanItem, item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game plan item not found")
    plan = db.get(DayPlan, item.plan_id)
    if not plan or plan.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game plan item not found")
    return item


def _get_event(db: Session, user: User, event_id: uuid.UUID) -> DayPlanEvent:
    event = db.get(DayPlanEvent, event_id)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    plan = db.get(DayPlan, event.plan_id)
    if not plan or plan.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return event


def get_or_create(db: Session, user: User, account_id: uuid.UUID, day: date_type) -> DayPlan:
    _owned_account(db, user, account_id)
    plan = db.scalar(
        select(DayPlan)
        .options(selectinload(DayPlan.items), selectinload(DayPlan.events))
        .where(DayPlan.user_id == user.id, DayPlan.account_id == account_id, DayPlan.date == day)
    )
    if plan:
        return plan

    plan = DayPlan(user_id=user.id, account_id=account_id, date=day, briefing="")
    db.add(plan)
    db.flush()

    versions = _versions(db, user.id)
    version = version_for_date(versions, day)
    config = config_from_snapshot(version.snapshot) if version else None
    for index, label in enumerate(seed_game_plan_labels(config, day)):
        db.add(DayPlanItem(plan_id=plan.id, label=label, done=False, sort_order=index))

    touch_progress(db, user, day)
    db.commit()
    plan = _load_plan(db, user, plan.id)
    logger.info("Created day plan %s user=%s date=%s", plan.id, user.id, day)
    return plan


def update_plan(db: Session, user: User, plan_id: uuid.UUID, payload: DayPlanUpdate) -> DayPlan:
    plan = _load_plan(db, user, plan_id)
    plan.briefing = payload.briefing
    touch_progress(db, user, plan.date)
    db.commit()
    db.refresh(plan)
    return _load_plan(db, user, plan.id)


def add_item(db: Session, user: User, plan_id: uuid.UUID, payload: DayPlanItemCreate) -> DayPlan:
    plan = _load_plan(db, user, plan_id)
    if len(plan.items) >= MAX_ITEMS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Maximum {MAX_ITEMS} game plan items")
    next_order = (max((i.sort_order for i in plan.items), default=-1) + 1)
    db.add(DayPlanItem(plan_id=plan.id, label=payload.label, done=False, sort_order=next_order))
    touch_progress(db, user, plan.date)
    db.commit()
    return _load_plan(db, user, plan.id)


def update_item(db: Session, user: User, item_id: uuid.UUID, payload: DayPlanItemUpdate) -> DayPlan:
    item = _get_item(db, user, item_id)
    if payload.label is not None:
        item.label = payload.label
    if payload.done is not None:
        item.done = payload.done
    if payload.sort_order is not None:
        item.sort_order = payload.sort_order
    plan_id = item.plan_id
    plan = db.get(DayPlan, plan_id)
    if plan:
        touch_progress(db, user, plan.date)
    db.commit()
    return _load_plan(db, user, plan_id)


def delete_item(db: Session, user: User, item_id: uuid.UUID) -> DayPlan:
    item = _get_item(db, user, item_id)
    plan_id = item.plan_id
    plan = db.get(DayPlan, plan_id)
    db.delete(item)
    if plan:
        touch_progress(db, user, plan.date)
    db.commit()
    return _load_plan(db, user, plan_id)


def add_event(db: Session, user: User, plan_id: uuid.UUID, payload: DayPlanEventCreate) -> DayPlan:
    plan = _load_plan(db, user, plan_id)
    if len(plan.events) >= MAX_EVENTS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Maximum {MAX_EVENTS} events")
    occurs = payload.occurs_on or plan.date
    if abs((occurs - plan.date).days) > 7:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Event must fall within a week of this day")
    next_order = (max((e.sort_order for e in plan.events), default=-1) + 1)
    db.add(
        DayPlanEvent(
            plan_id=plan.id,
            title=payload.title,
            note=payload.note,
            occurs_on=occurs,
            impact=payload.impact,
            sort_order=next_order,
        )
    )
    db.commit()
    return _load_plan(db, user, plan.id)


def update_event(db: Session, user: User, event_id: uuid.UUID, payload: DayPlanEventUpdate) -> DayPlan:
    event = _get_event(db, user, event_id)
    plan = db.get(DayPlan, event.plan_id)
    if payload.title is not None:
        event.title = payload.title
    if payload.note is not None:
        event.note = payload.note
    if payload.occurs_on is not None:
        if plan and abs((payload.occurs_on - plan.date).days) > 7:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Event must fall within a week of this day"
            )
        event.occurs_on = payload.occurs_on
    if payload.impact is not None:
        event.impact = payload.impact
    db.commit()
    return _load_plan(db, user, event.plan_id)


def delete_event(db: Session, user: User, event_id: uuid.UUID) -> DayPlan:
    event = _get_event(db, user, event_id)
    plan_id = event.plan_id
    db.delete(event)
    db.commit()
    return _load_plan(db, user, plan_id)
