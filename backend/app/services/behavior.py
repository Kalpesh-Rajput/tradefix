"""Rule-based behavioral auto-tagging (revenge trading, overtrading)."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.trade import Trade, TradeStatus


def apply_behavior_flags(db: Session, user_id: uuid.UUID, trade: Trade) -> None:
    flags = list(trade.auto_flags or [])
    emotions = list(trade.emotion_tags or [])

    # Revenge: new trade within 30m of a loss with larger size
    if trade.opened_at:
        window_start = trade.opened_at - timedelta(minutes=30)
        prior = db.scalars(
            select(Trade)
            .where(
                Trade.user_id == user_id,
                Trade.account_id == trade.account_id,
                Trade.id != trade.id,
                Trade.status == TradeStatus.closed,
                Trade.closed_at.is_not(None),
                Trade.closed_at >= window_start,
                Trade.closed_at <= trade.opened_at,
                Trade.pnl.is_not(None),
                Trade.pnl < 0,
            )
            .order_by(Trade.closed_at.desc())
            .limit(1)
        ).first()
        if prior and float(trade.quantity) > float(prior.quantity) * 1.1:
            if "revenge_trading" not in flags:
                flags.append("revenge_trading")
            if "Revenge Trading" not in emotions:
                emotions.append("Revenge Trading")

    # Overtrading: day's closed+open count > 2x historical median of daily counts
    day = (trade.opened_at or datetime.now(timezone.utc)).astimezone(timezone.utc).date()
    day_start = datetime.combine(day, datetime.min.time()).replace(tzinfo=timezone.utc)
    day_end = datetime.combine(day, datetime.max.time()).replace(tzinfo=timezone.utc)
    day_count = db.scalar(
        select(func.count(Trade.id)).where(
            Trade.user_id == user_id,
            Trade.account_id == trade.account_id,
            Trade.opened_at >= day_start,
            Trade.opened_at <= day_end,
        )
    ) or 0

    # Approximate median via last 30 trading days with activity
    recent = db.scalars(
        select(Trade.opened_at).where(
            Trade.user_id == user_id,
            Trade.account_id == trade.account_id,
            Trade.opened_at < day_start,
        ).order_by(Trade.opened_at.desc()).limit(500)
    ).all()
    buckets: dict = {}
    for opened in recent:
        if opened is None:
            continue
        d = opened.astimezone(timezone.utc).date()
        buckets[d] = buckets.get(d, 0) + 1
    counts = sorted(buckets.values())
    if counts:
        mid = counts[len(counts) // 2]
        if mid >= 1 and day_count > mid * 2:
            if "overtrading" not in flags:
                flags.append("overtrading")
            if "Overtrading" not in emotions:
                emotions.append("Overtrading")

    trade.auto_flags = flags
    trade.emotion_tags = emotions
