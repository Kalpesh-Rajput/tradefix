from __future__ import annotations

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.user import User
from app.schemas.news import (
    NewsArticleOut,
    NewsBookmarkCreate,
    NewsCategory,
    NewsDateRange,
    NewsFeedResponse,
    NewsSentiment,
    NewsSort,
)
from app.services.news import (
    delete_bookmark,
    get_news_feed,
    list_bookmarks,
    save_bookmark,
)
from app.services.rate_limit import news_bookmark_limiter, news_refresh_limiter

router = APIRouter(prefix="/api/news", tags=["news"])


@router.get("", response_model=NewsFeedResponse)
def read_news_feed(
    category: NewsCategory = Query("all"),
    query: str | None = Query(default=None, max_length=120),
    symbol: str | None = Query(default=None, max_length=24),
    source: str | None = Query(default=None, max_length=120),
    sentiment: NewsSentiment | None = Query(default=None),
    date_range: NewsDateRange = Query("all"),
    sort: NewsSort = Query("newest"),
    page: int = Query(1, ge=1, le=50),
    page_size: int = Query(20, ge=1, le=50),
    refresh: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NewsFeedResponse:
    if refresh:
        news_refresh_limiter.check(f"news-refresh:{current_user.id}")

    return get_news_feed(
        db,
        current_user,
        category=category,
        query=query,
        symbol=symbol,
        source=source,
        sentiment=sentiment,
        date_range=date_range,
        sort=sort,
        page=page,
        page_size=page_size,
        force_refresh=refresh,
    )


@router.get("/bookmarks", response_model=list[NewsArticleOut])
def read_news_bookmarks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[NewsArticleOut]:
    return list_bookmarks(db, current_user)


@router.post("/bookmarks", response_model=NewsArticleOut, status_code=status.HTTP_201_CREATED)
def create_news_bookmark(
    payload: NewsBookmarkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NewsArticleOut:
    news_bookmark_limiter.check(f"news-bookmark:{current_user.id}")
    return save_bookmark(db, current_user, payload)


@router.delete("/bookmarks/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_news_bookmark(
    article_id: str = Path(..., min_length=4, max_length=64),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    news_bookmark_limiter.check(f"news-bookmark:{current_user.id}")
    delete_bookmark(db, current_user, article_id)
    return None
