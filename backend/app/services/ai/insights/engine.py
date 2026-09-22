from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.progress_tracker import ProgressTrackerSettings
from app.models.trade import Trade, TradeStatus
from app.models.user import User
from app.schemas.ai_insights import AiInsightsFeed
from app.services.ai.insights.feed import build_feed
from app.services.ai.insights.snapshot import (
    get_snapshot,
    is_fresh,
    latest_closed_trade_at,
    upsert_snapshot,
)

logger = logging.getLogger(__name__)

LOOKBACK_DAYS = 120


def _load_trades(db: Session, user_id: uuid.UUID, account_id: uuid.UUID | None) -> list[Trade]:
    since = datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)
    stmt = select(Trade).where(
        Trade.user_id == user_id,
        Trade.status == TradeStatus.closed,
        Trade.pnl.is_not(None),
        Trade.is_deleted.is_(False),
        Trade.opened_at >= since,
    )
    if account_id is not None:
        stmt = stmt.where(Trade.account_id == account_id)
    return list(db.scalars(stmt.order_by(Trade.opened_at.asc())).all())


def _max_loss(db: Session, user_id: uuid.UUID) -> float | None:
    settings = db.scalar(select(ProgressTrackerSettings).where(ProgressTrackerSettings.user_id == user_id))
    if not settings or not settings.max_loss_per_trade_enabled:
        return None
    value = float(settings.max_loss_per_trade_value or 0)
    return value if value > 0 else None


def get_or_compute_feed(
    db: Session,
    user: User,
    account_id: uuid.UUID | None,
    *,
    force: bool = False,
    include_news: bool = False,
) -> AiInsightsFeed:
    latest = latest_closed_trade_at(db, user.id, account_id)
    snapshot = get_snapshot(db, user.id, account_id)
    if not force and is_fresh(snapshot, latest) and snapshot is not None:
        return AiInsightsFeed.model_validate(snapshot.payload)

    trades = _load_trades(db, user.id, account_id)
    feed = build_feed(trades, include_news=include_news or force, max_loss=_max_loss(db, user.id))
    upsert_snapshot(
        db,
        user_id=user.id,
        account_id=account_id,
        payload=feed.model_dump(mode="json"),
        trades_analysed=feed.trades_analysed,
        latest_trade_at=latest,
    )
    db.commit()
    logger.info(
        "Computed AI insights user=%s account=%s trades=%s cards=%s",
        user.id,
        account_id,
        feed.trades_analysed,
        len(feed.insights),
    )
    return feed
