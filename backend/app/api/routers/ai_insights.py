from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.account import Account
from app.models.user import User
from app.schemas.ai_insights import AiInsightsFeed
from app.services.ai.insights.engine import get_or_compute_feed

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai/insights", tags=["ai-insights"])


def _owned_account(db: Session, user: User, account_id: uuid.UUID | None) -> uuid.UUID | None:
    if account_id is None:
        return None
    account = db.get(Account, account_id)
    if not account or account.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return account_id


@router.get("", response_model=AiInsightsFeed)
def get_insights(
    account_id: uuid.UUID | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scoped = _owned_account(db, current_user, account_id)
    feed = get_or_compute_feed(db, current_user, scoped, force=False, include_news=False)
    logger.info(
        "AI insights served user=%s account=%s trades=%s cards=%s",
        current_user.id,
        scoped,
        feed.trades_analysed,
        len(feed.insights),
    )
    return feed


@router.post("/refresh", response_model=AiInsightsFeed)
def refresh_insights(
    account_id: uuid.UUID | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scoped = _owned_account(db, current_user, account_id)
    feed = get_or_compute_feed(db, current_user, scoped, force=True, include_news=True)
    logger.info(
        "AI insights refreshed user=%s account=%s trades=%s cards=%s",
        current_user.id,
        scoped,
        feed.trades_analysed,
        len(feed.insights),
    )
    return feed
