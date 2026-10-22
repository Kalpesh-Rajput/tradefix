from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

NewsCategory = Literal[
    "all",
    "forex",
    "crypto",
    "stocks",
    "indices",
    "commodities",
    "economy",
    "central_banks",
]

NewsSentiment = Literal["positive", "negative", "neutral"]
NewsSymbolsSource = Literal["provider", "contextual", "none"]
NewsFreshness = Literal["latest", "cached", "stale"]
NewsDateRange = Literal["24h", "7d", "30d", "all"]
NewsSort = Literal["newest", "relevance"]


class ProviderHealthStatus(BaseModel):
    provider: str
    enabled: bool
    healthy: bool
    status: Literal["ok", "cached", "rate_limited", "quota_exhausted", "error", "disabled", "unconfigured"]
    article_count: int = 0
    detail: str | None = None


class NewsArticleOut(BaseModel):
    id: str
    title: str
    summary: str | None = None
    source: str
    source_domain: str | None = None
    url: str
    published_at: datetime
    category: NewsCategory = "all"
    symbols: list[str] = Field(default_factory=list)
    symbols_source: NewsSymbolsSource = "none"
    sentiment: NewsSentiment | None = None
    sentiment_score: float | None = None
    image_url: str | None = None
    language: str = "en"
    provider: str
    relevance_score: float = 0.0
    is_bookmarked: bool = False
    saved_at: datetime | None = None


class NewsFeedMeta(BaseModel):
    candidate_count: int
    page: int
    page_size: int
    has_more: bool
    fetched_at: datetime
    freshness: NewsFreshness
    cache_ttl_seconds: int
    active_providers: list[str]
    provider_status: list[ProviderHealthStatus]
    sentiment_available: bool
    available_sources: list[str]
    watchlist_symbols: list[str]


class NewsFeedResponse(BaseModel):
    featured: NewsArticleOut | None = None
    articles: list[NewsArticleOut]
    meta: NewsFeedMeta


class NewsBookmarkCreate(BaseModel):
    article_id: str = Field(..., min_length=4, max_length=64)
    title: str = Field(..., min_length=1, max_length=512)
    summary: str | None = Field(default=None, max_length=2000)
    url: str = Field(..., min_length=8, max_length=2048)
    source: str = Field(..., min_length=1, max_length=255)
    source_domain: str | None = Field(default=None, max_length=255)
    published_at: datetime
    category: NewsCategory = "all"
    symbols: list[str] = Field(default_factory=list, max_length=12)
    symbols_source: NewsSymbolsSource = "none"
    sentiment: NewsSentiment | None = None
    sentiment_score: float | None = Field(default=None, ge=-1.0, le=1.0)
    provider: str = Field(default="google_rss", max_length=32)
