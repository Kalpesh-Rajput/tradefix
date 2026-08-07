from __future__ import annotations

import uuid
from datetime import date as date_type
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.daily_checkin import DailyCheckin
from app.models.daily_recap import DailyRecap
from app.models.mood import MoodCheckin
from app.models.trade import Trade
from app.models.user import User
from app.schemas.checkin import (
    DailyCheckinResponse,
    DailyCheckinUpsert,
    MilestoneItem,
    MilestonesResponse,
)

router = APIRouter(prefix="/api/checkins", tags=["checkins"])


def _to_response(row: DailyCheckin) -> DailyCheckinResponse:
    return DailyCheckinResponse(
        id=row.id,
        date=row.date,
        account_id=row.account_id,
        max_loss=float(row.max_loss) if row.max_loss is not None else None,
        max_trades=row.max_trades,
        focus_setup=row.focus_setup,
        goal_note=row.goal_note,
        followed=row.followed,
        evening_note=row.evening_note,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.get("/today", response_model=DailyCheckinResponse | None)
def get_today_checkin(
    date: date_type | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    d = date or datetime.now(timezone.utc).date()
    row = db.scalar(
        select(DailyCheckin).where(DailyCheckin.user_id == current_user.id, DailyCheckin.date == d)
    )
    return _to_response(row) if row else None


@router.get("", response_model=list[DailyCheckinResponse])
def list_checkins(
    limit: int = Query(90, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.scalars(
        select(DailyCheckin)
        .where(DailyCheckin.user_id == current_user.id)
        .order_by(DailyCheckin.date.desc())
        .limit(limit)
    ).all()
    return [_to_response(r) for r in rows]


@router.post("", response_model=DailyCheckinResponse)
def upsert_checkin(
    payload: DailyCheckinUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.scalar(
        select(DailyCheckin).where(
            DailyCheckin.user_id == current_user.id,
            DailyCheckin.date == payload.date,
        )
    )
    followed = payload.followed if payload.followed in ("yes", "partial", "no", None) else None
    if row:
        row.account_id = payload.account_id
        row.max_loss = payload.max_loss
        row.max_trades = payload.max_trades
        row.focus_setup = (payload.focus_setup or None)
        row.goal_note = payload.goal_note
        if payload.followed is not None:
            row.followed = followed
        if payload.evening_note is not None:
            row.evening_note = payload.evening_note
    else:
        row = DailyCheckin(
            user_id=current_user.id,
            account_id=payload.account_id,
            date=payload.date,
            max_loss=payload.max_loss,
            max_trades=payload.max_trades,
            focus_setup=payload.focus_setup,
            goal_note=payload.goal_note,
            followed=followed,
            evening_note=payload.evening_note,
        )
        db.add(row)
    db.commit()
    db.refresh(row)
    return _to_response(row)


@router.get("/milestones", response_model=MilestonesResponse)
def get_milestones(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    trade_count = db.scalar(select(func.count(Trade.id)).where(Trade.user_id == current_user.id)) or 0

    mood_dates = set(db.scalars(select(MoodCheckin.date).where(MoodCheckin.user_id == current_user.id)).all())
    recap_dates = set(db.scalars(select(DailyRecap.date).where(DailyRecap.user_id == current_user.id)).all())
    checkin_dates = set(db.scalars(select(DailyCheckin.date).where(DailyCheckin.user_id == current_user.id)).all())
    shot_trades = db.scalars(select(Trade).where(Trade.user_id == current_user.id)).all()
    for t in shot_trades:
        if t.screenshot_urls and t.opened_at:
            checkin_dates.add(t.opened_at.date())
    journal_days = len(mood_dates | recap_dates | checkin_dates)

    # No revenge streak ending today
    revenge_days = set()
    flagged = db.scalars(
        select(Trade).where(Trade.user_id == current_user.id)
    ).all()
    for t in flagged:
        emotions = [e.lower() for e in (t.emotion_tags or [])]
        flags = list(t.auto_flags or [])
        if "revenge trading" in emotions or "revenge_trading" in flags:
            if t.opened_at:
                revenge_days.add(t.opened_at.date())

    today = datetime.now(timezone.utc).date()
    no_revenge = 0
    cursor = today
    while cursor not in revenge_days and no_revenge < 365:
        # only count days that had trades or journal activity, or just calendar days?
        # Spec: consecutive calendar days without revenge tag
        no_revenge += 1
        cursor = cursor - timedelta(days=1)
        if cursor in revenge_days:
            no_revenge -= 0
            break
        # stop if we go before account creation roughly 400 days
        if no_revenge >= 400:
            break

    defs = [
        ("trades_10", "10 Trades", "Log your first 10 trades", trade_count, 10),
        ("trades_50", "50 Trades", "Build a meaningful sample", trade_count, 50),
        ("trades_100", "100 Trades", "Century club", trade_count, 100),
        ("trades_500", "500 Trades", "Serious journaler", trade_count, 500),
        ("trades_1000", "1000 Trades", "Trading career archive", trade_count, 1000),
        ("journal_7", "7 Days Journaled", "One week habit", journal_days, 7),
        ("journal_30", "30 Days Journaled", "Monthly consistency", journal_days, 30),
        ("journal_100", "100 Days Journaled", "Deep habit", journal_days, 100),
        ("no_revenge_7", "No Revenge 7 Days", "Stay disciplined for a week", min(no_revenge, 7), 7),
        ("no_revenge_30", "No Revenge 30 Days", "Stay disciplined for a month", min(no_revenge, 30), 30),
    ]
    items = [
        MilestoneItem(
            id=i,
            label=label,
            description=desc,
            unlocked=progress >= target,
            progress=min(progress, target),
            target=target,
        )
        for i, label, desc, progress, target in defs
    ]
    return MilestonesResponse(items=items, unlocked_count=sum(1 for x in items if x.unlocked))
