from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.progress_tracker import ProgressTrackerSettings
from app.models.trade import Trade, TradeStatus
from app.models.user import User
from app.schemas.ai_insights import AiInsightsFeed, InsightFacets, InsightPlaybookFacet
from app.services.ai.insights.cohorts import opened_at, setup_of
from app.services.ai.insights.feed import build_feed
from app.services.ai.insights.snapshot import (
    get_snapshot,
    is_fresh,
    latest_closed_trade_at,
    upsert_snapshot,
)

logger = logging.getLogger(__name__)

WINDOW_DAYS: dict[str, int | None] = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
    "6m": 182,
    "1y": 365,
    "all": None,
}
ALL_CHANGE_DAYS = 90


@dataclass(frozen=True)
class InsightFilters:
    setup: str | None = None
    symbol: str | None = None
    session: str | None = None
    side: str | None = None
    playbook_id: uuid.UUID | None = None

    def active(self) -> bool:
        return any((self.setup, self.symbol, self.session, self.side, self.playbook_id))


def _load_trades(
    db: Session,
    user_id: uuid.UUID,
    account_id: uuid.UUID | None,
    since: datetime | None,
) -> list[Trade]:
    stmt = (
        select(Trade)
        .options(selectinload(Trade.playbook))
        .where(
            Trade.user_id == user_id,
            Trade.status == TradeStatus.closed,
            Trade.pnl.is_not(None),
            Trade.is_deleted.is_(False),
        )
    )
    if since is not None:
        stmt = stmt.where(Trade.opened_at >= since)
    if account_id is not None:
        stmt = stmt.where(Trade.account_id == account_id)
    return list(db.scalars(stmt.order_by(Trade.opened_at.asc())).all())


def _side(trade: Trade) -> str:
    side = trade.side
    return side.value if hasattr(side, "value") else str(side)


def _in_window(trade: Trade, cutoff: datetime | None) -> bool:
    if cutoff is None:
        return True
    stamp = opened_at(trade)
    return stamp is not None and stamp >= cutoff


def _matches(trade: Trade, filters: InsightFilters) -> bool:
    if filters.setup and setup_of(trade) != filters.setup:
        return False
    if filters.symbol and (trade.symbol or "").lower() != filters.symbol.lower():
        return False
    if filters.session and (trade.session or "").strip() != filters.session:
        return False
    if filters.side and _side(trade) != filters.side:
        return False
    if filters.playbook_id and trade.playbook_id != filters.playbook_id:
        return False
    return True


def _facets(trades: list[Trade]) -> InsightFacets:
    setups = sorted({name for trade in trades if (name := setup_of(trade))})
    symbols = sorted({trade.symbol for trade in trades if trade.symbol})
    sessions = sorted({(trade.session or "").strip() for trade in trades if (trade.session or "").strip()})
    sides = sorted({_side(trade) for trade in trades if trade.side})
    playbooks: dict[uuid.UUID, str] = {}
    for trade in trades:
        if trade.playbook_id and trade.playbook is not None:
            playbooks[trade.playbook_id] = trade.playbook.name
    return InsightFacets(
        setups=setups,
        symbols=symbols,
        sessions=sessions,
        sides=sides,
        playbooks=[
            InsightPlaybookFacet(id=playbook_id, name=name)
            for playbook_id, name in sorted(playbooks.items(), key=lambda item: item[1].lower())
        ],
    )


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
    window: str = "30d",
    filters: InsightFilters | None = None,
) -> AiInsightsFeed:
    window_key = window if window in WINDOW_DAYS else "30d"
    active_filters = filters or InsightFilters()
    days = WINDOW_DAYS[window_key]
    now = datetime.now(timezone.utc)
    latest = latest_closed_trade_at(db, user.id, account_id)

    if not active_filters.active():
        snapshot = get_snapshot(db, user.id, account_id, window_key)
        if not force and is_fresh(snapshot, latest) and snapshot is not None:
            return AiInsightsFeed.model_validate(snapshot.payload)

    since = None if days is None else now - timedelta(days=days * 2)
    loaded = _load_trades(db, user.id, account_id, since)
    cutoff = None if days is None else now - timedelta(days=days)
    unfiltered_current = [trade for trade in loaded if _in_window(trade, cutoff)]
    facets = _facets(unfiltered_current)
    history = [trade for trade in loaded if _matches(trade, active_filters)]
    current = [trade for trade in history if _in_window(trade, cutoff)]
    change_days = days if days is not None else ALL_CHANGE_DAYS

    feed = build_feed(
        current,
        include_news=include_news or force,
        max_loss=_max_loss(db, user.id),
        window_days=change_days,
        history=history,
        now=now,
    )
    feed = feed.model_copy(update={"facets": facets})

    if not active_filters.active():
        upsert_snapshot(
            db,
            user_id=user.id,
            account_id=account_id,
            payload=feed.model_dump(mode="json"),
            trades_analysed=feed.trades_analysed,
            latest_trade_at=latest,
            window_key=window_key,
        )
        db.commit()

    logger.info(
        "Computed AI insights user=%s account=%s window=%s filtered=%s trades=%s cards=%s",
        user.id,
        account_id,
        window_key,
        active_filters.active(),
        feed.trades_analysed,
        len(feed.insights),
    )
    return feed
