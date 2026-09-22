from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from app.models.ai_insight_snapshot import AiInsightSnapshot
from app.models.trade import Trade, TradeStatus
from app.services.ai.insights.types import STALE_HOURS

logger = logging.getLogger(__name__)


def latest_closed_trade_at(
    db: Session, user_id: uuid.UUID, account_id: uuid.UUID | None
) -> datetime | None:
    stmt = select(func.max(func.coalesce(Trade.closed_at, Trade.opened_at))).where(
        Trade.user_id == user_id,
        Trade.status == TradeStatus.closed,
        Trade.pnl.is_not(None),
        Trade.is_deleted.is_(False),
    )
    if account_id is not None:
        stmt = stmt.where(Trade.account_id == account_id)
    return db.scalar(stmt)


def get_snapshot(
    db: Session, user_id: uuid.UUID, account_id: uuid.UUID | None
) -> AiInsightSnapshot | None:
    stmt = select(AiInsightSnapshot).where(AiInsightSnapshot.user_id == user_id)
    if account_id is None:
        stmt = stmt.where(AiInsightSnapshot.account_id.is_(None))
    else:
        stmt = stmt.where(AiInsightSnapshot.account_id == account_id)
    return db.scalar(stmt)


def is_fresh(snapshot: AiInsightSnapshot | None, latest_trade_at: datetime | None) -> bool:
    if snapshot is None:
        return False
    generated = snapshot.generated_at
    if generated.tzinfo is None:
        generated = generated.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) - generated > timedelta(hours=STALE_HOURS):
        return False
    if latest_trade_at is None:
        return True
    snap_latest = snapshot.latest_trade_at
    if snap_latest is None:
        return False
    if snap_latest.tzinfo is None:
        snap_latest = snap_latest.replace(tzinfo=timezone.utc)
    latest = latest_trade_at if latest_trade_at.tzinfo else latest_trade_at.replace(tzinfo=timezone.utc)
    return snap_latest >= latest


def upsert_snapshot(
    db: Session,
    *,
    user_id: uuid.UUID,
    account_id: uuid.UUID | None,
    payload: dict,
    trades_analysed: int,
    latest_trade_at: datetime | None,
) -> AiInsightSnapshot:
    row = get_snapshot(db, user_id, account_id)
    now = datetime.now(timezone.utc)
    if row is None:
        row = AiInsightSnapshot(
            user_id=user_id,
            account_id=account_id,
            generated_at=now,
            trades_analysed=trades_analysed,
            latest_trade_at=latest_trade_at,
            payload=payload,
        )
        db.add(row)
    else:
        row.generated_at = now
        row.trades_analysed = trades_analysed
        row.latest_trade_at = latest_trade_at
        row.payload = payload
    db.flush()
    return row


def invalidate_snapshots(db: Session, user_id: uuid.UUID, account_id: uuid.UUID | None = None) -> None:
    stmt = delete(AiInsightSnapshot).where(AiInsightSnapshot.user_id == user_id)
    if account_id is not None:
        stmt = stmt.where(
            or_(AiInsightSnapshot.account_id == account_id, AiInsightSnapshot.account_id.is_(None))
        )
    db.execute(stmt)


def touch_ai_insights(db: Session, user_id: uuid.UUID, account_id: uuid.UUID | None = None) -> None:
    try:
        invalidate_snapshots(db, user_id, account_id)
    except Exception:
        logger.exception("AI insight snapshot invalidation failed user=%s", user_id)
