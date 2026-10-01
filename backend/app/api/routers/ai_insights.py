from __future__ import annotations

import logging
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.account import Account
from app.models.user import User
from app.schemas.ai_insights import AiInsightsFeed
from app.services.ai.insights.engine import InsightFilters, get_or_compute_feed

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai/insights", tags=["ai-insights"])

WindowKey = Literal["7d", "30d", "90d", "6m", "1y", "all"]


def _owned_account(db: Session, user: User, account_id: uuid.UUID | None) -> uuid.UUID | None:
    if account_id is None:
        return None
    account = db.get(Account, account_id)
    if not account or account.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return account_id


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    text = value.strip()
    return text or None


def _filters(
    setup: str | None,
    symbol: str | None,
    session: str | None,
    side: str | None,
    playbook_id: uuid.UUID | None,
) -> InsightFilters:
    direction = _clean(side)
    if direction is not None and direction not in {"long", "short"}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid direction")
    return InsightFilters(
        setup=_clean(setup),
        symbol=_clean(symbol),
        session=_clean(session),
        side=direction,
        playbook_id=playbook_id,
    )


@router.get("", response_model=AiInsightsFeed)
def get_insights(
    account_id: uuid.UUID | None = Query(None),
    window: WindowKey = Query("30d"),
    setup: str | None = Query(None, max_length=100),
    symbol: str | None = Query(None, max_length=32),
    session: str | None = Query(None, max_length=64),
    side: str | None = Query(None, max_length=8),
    playbook_id: uuid.UUID | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scoped = _owned_account(db, current_user, account_id)
    filters = _filters(setup, symbol, session, side, playbook_id)
    feed = get_or_compute_feed(
        db,
        current_user,
        scoped,
        force=False,
        include_news=False,
        window=window,
        filters=filters,
    )
    logger.info(
        "AI insights served user=%s account=%s window=%s trades=%s cards=%s",
        current_user.id,
        scoped,
        window,
        feed.trades_analysed,
        len(feed.insights),
    )
    return feed


@router.post("/refresh", response_model=AiInsightsFeed)
def refresh_insights(
    account_id: uuid.UUID | None = Query(None),
    window: WindowKey = Query("30d"),
    setup: str | None = Query(None, max_length=100),
    symbol: str | None = Query(None, max_length=32),
    session: str | None = Query(None, max_length=64),
    side: str | None = Query(None, max_length=8),
    playbook_id: uuid.UUID | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scoped = _owned_account(db, current_user, account_id)
    filters = _filters(setup, symbol, session, side, playbook_id)
    feed = get_or_compute_feed(
        db,
        current_user,
        scoped,
        force=True,
        include_news=True,
        window=window,
        filters=filters,
    )
    logger.info(
        "AI insights refreshed user=%s account=%s window=%s trades=%s cards=%s",
        current_user.id,
        scoped,
        window,
        feed.trades_analysed,
        len(feed.insights),
    )
    return feed
