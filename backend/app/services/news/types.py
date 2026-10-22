from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal

from app.schemas.news import NewsCategory, NewsSentiment, NewsSymbolsSource


@dataclass
class RawProviderArticle:
    provider: str
    title: str
    url: str
    published_at: datetime | str | int | float | None = None
    summary: str | None = None
    source: str | None = None
    source_domain: str | None = None
    external_id: str | None = None
    image_url: str | None = None
    language: str = "en"
    provider_symbols: list[str] = field(default_factory=list)
    provider_entity_types: list[str] = field(default_factory=list)
    provider_sentiment: NewsSentiment | None = None
    provider_sentiment_score: float | None = None


@dataclass
class NormalizedArticle:
    id: str
    title: str
    summary: str | None
    source: str
    source_domain: str | None
    url: str
    canonical_url: str
    published_at: datetime
    category: NewsCategory
    symbols: list[str]
    symbols_source: NewsSymbolsSource
    sentiment: NewsSentiment | None
    sentiment_score: float | None
    image_url: str | None
    language: str
    provider: str
    relevance_score: float = 0.0


@dataclass
class ProviderFetchResult:
    provider: str
    enabled: bool
    healthy: bool
    status: Literal["ok", "cached", "rate_limited", "quota_exhausted", "error", "disabled", "unconfigured"]
    articles: list[RawProviderArticle] = field(default_factory=list)
    detail: str | None = None
