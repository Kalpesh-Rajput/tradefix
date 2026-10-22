"""Financial News Terminal core service.

Orchestrates isolated provider adapters, two-tier caching, normalization,
deduplication, contextual filtering, featured-story selection, and per-user bookmarks.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.news_bookmark import NewsBookmark
from app.models.trade import Trade
from app.models.user import User
from app.models.watchlist import WatchlistItem
from app.schemas.news import (
    NewsArticleOut,
    NewsBookmarkCreate,
    NewsCategory,
    NewsDateRange,
    NewsFeedMeta,
    NewsFeedResponse,
    NewsFreshness,
    NewsSentiment,
    NewsSort,
    ProviderHealthStatus,
)
from app.services.news.cache import CandidatePoolEntry, cache_store, pool_cache_key
from app.services.news.classifier import compute_relevance_score, normalize_provider_symbol
from app.services.news.normalizer import (
    deduplicate_articles,
    normalize_raw_article,
    parse_utc_timestamp,
    sanitize_text,
    validate_and_canonicalize_url,
)
from app.services.news.providers import (
    fetch_gdelt_doc,
    fetch_google_rss,
    fetch_marketaux,
    reset_gdelt_pacing,
    reset_marketaux_quota,
)
from app.services.news.types import NormalizedArticle, ProviderFetchResult

logger = logging.getLogger(__name__)


def reset_news_state() -> None:
    cache_store.reset()
    reset_gdelt_pacing()
    reset_marketaux_quota()


def enabled_providers_tuple() -> tuple[str, ...]:
    enabled: list[str] = []
    if settings.news_google_rss_enabled:
        enabled.append("google_rss")
    if settings.news_gdelt_enabled:
        enabled.append("gdelt")
    if settings.news_marketaux_enabled and (settings.marketaux_api_token or "").strip():
        enabled.append("marketaux")
    return tuple(enabled)


def _fetch_all_providers(
    category: NewsCategory,
    search_query: str | None,
    *,
    force_refresh: bool = False,
) -> list[ProviderFetchResult]:
    return [
        fetch_marketaux(category, search_query, force_refresh=force_refresh),
        fetch_google_rss(category, search_query, force_refresh=force_refresh),
        fetch_gdelt_doc(category, search_query, force_refresh=force_refresh),
    ]


def load_candidate_pool(
    category: NewsCategory,
    search_query: str | None = None,
    *,
    force_refresh: bool = False,
) -> tuple[CandidatePoolEntry, NewsFreshness]:
    ttl = max(30, int(settings.news_cache_ttl_seconds))
    enabled_sig = enabled_providers_tuple()
    if not enabled_sig:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="All financial news providers are currently disabled.",
        )

    key = pool_cache_key(category, search_query, enabled_sig)
    if not force_refresh:
        cached_pool = cache_store.get_pool(key, ttl)
        if cached_pool is not None:
            return cached_pool, "cached"

    flight_lock = cache_store.flight_lock_for(key)
    with flight_lock:
        if not force_refresh:
            cached_pool = cache_store.get_pool(key, ttl)
            if cached_pool is not None:
                return cached_pool, "cached"

        provider_results = _fetch_all_providers(category, search_query, force_refresh=force_refresh)
        statuses: list[ProviderHealthStatus] = []
        active_providers: list[str] = []
        raw_normalized: list[NormalizedArticle] = []
        any_healthy = False

        for res in provider_results:
            count_valid = 0
            for raw_item in res.articles:
                norm = normalize_raw_article(
                    raw_item,
                    hint_category=category if category != "all" else None,
                    search_query=search_query,
                )
                if norm is not None:
                    raw_normalized.append(norm)
                    count_valid += 1

            statuses.append(
                ProviderHealthStatus(
                    provider=res.provider,
                    enabled=res.enabled,
                    healthy=res.healthy,
                    status=res.status,
                    article_count=count_valid,
                    detail=res.detail,
                )
            )
            if res.enabled and (res.healthy or count_valid > 0):
                any_healthy = True
                active_providers.append(res.provider)

        deduped = deduplicate_articles(raw_normalized)

        if not any_healthy and not deduped:
            stale_pool = cache_store.get_stale_pool(key)
            if stale_pool is not None:
                return stale_pool, "stale"
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Unable to retrieve financial news from upstream providers right now. Please retry shortly.",
            )

        all_from_cache = all(
            r.status in {"cached", "disabled", "unconfigured"}
            for r in provider_results
            if r.enabled
        )
        freshness: NewsFreshness = "cached" if (all_from_cache and not force_refresh) else "latest"
        entry = cache_store.put_pool(key, deduped, statuses, active_providers)
        return entry, freshness


def _matches_symbol(article: NormalizedArticle, target_symbol: str) -> bool:
    norm_target = normalize_provider_symbol(target_symbol) or target_symbol.strip().upper()
    plain_target = norm_target.replace("/", "").replace("-", "")
    for sym in article.symbols:
        if sym.upper() == norm_target or sym.upper().replace("/", "") == plain_target:
            return True
    # Also check title/summary if the user entered a custom watchlist symbol
    haystack = f"{article.title} {article.summary or ''}".upper()
    return norm_target in haystack or (len(plain_target) >= 4 and plain_target in haystack)


def _filter_and_sort_pool(
    pool: list[NormalizedArticle],
    *,
    category: NewsCategory,
    search_query: str | None,
    symbol: str | None,
    source: str | None,
    sentiment: NewsSentiment | None,
    date_range: NewsDateRange,
    sort: NewsSort,
) -> list[NormalizedArticle]:
    now = datetime.now(timezone.utc)
    cutoff: datetime | None = None
    if date_range == "24h":
        cutoff = now - timedelta(hours=24)
    elif date_range == "7d":
        cutoff = now - timedelta(days=7)
    elif date_range == "30d":
        cutoff = now - timedelta(days=30)

    q_tokens = (
        [t.lower() for t in search_query.strip().split() if t.strip()]
        if search_query and search_query.strip()
        else []
    )
    source_norm = source.strip().lower() if source and source.strip() else None

    filtered: list[NormalizedArticle] = []
    for item in pool:
        if category != "all" and item.category != category:
            continue
        if cutoff is not None and item.published_at < cutoff:
            continue
        if symbol and symbol.strip() and not _matches_symbol(item, symbol):
            continue
        if source_norm:
            src_match = (
                item.source.lower() == source_norm
                or (item.source_domain and item.source_domain.lower() == source_norm)
            )
            if not src_match:
                continue
        if sentiment and item.sentiment != sentiment:
            continue
        if q_tokens:
            text_l = f"{item.title} {item.summary or ''} {item.source} {' '.join(item.symbols)}".lower()
            if not all(tok in text_l for tok in q_tokens):
                continue

        # Recompute relevance when a search query is present
        rel = (
            compute_relevance_score(item.title, item.summary, item.symbols, item.category, search_query=search_query)
            if search_query
            else item.relevance_score
        )
        if rel != item.relevance_score:
            item = NormalizedArticle(
                id=item.id,
                title=item.title,
                summary=item.summary,
                source=item.source,
                source_domain=item.source_domain,
                url=item.url,
                canonical_url=item.canonical_url,
                published_at=item.published_at,
                category=item.category,
                symbols=item.symbols,
                symbols_source=item.symbols_source,
                sentiment=item.sentiment,
                sentiment_score=item.sentiment_score,
                image_url=item.image_url,
                language=item.language,
                provider=item.provider,
                relevance_score=rel,
            )
        filtered.append(item)

    if sort == "relevance":
        filtered.sort(
            key=lambda a: (a.relevance_score, a.published_at.timestamp(), a.id),
            reverse=True,
        )
    else:
        filtered.sort(
            key=lambda a: (a.published_at.timestamp(), a.relevance_score, a.id),
            reverse=True,
        )
    return filtered


def select_featured_article(filtered_pool: list[NormalizedArticle]) -> NormalizedArticle | None:
    """Select the best featured story from the currently filtered and sorted candidate pool."""
    if not filtered_pool:
        return None
    # Prefer one of the top 8 filtered stories that has a genuine provider summary and instrument tags
    for candidate in filtered_pool[:8]:
        if candidate.summary and len(candidate.summary) >= 40 and candidate.symbols:
            return candidate
    for candidate in filtered_pool[:8]:
        if candidate.summary and len(candidate.summary) >= 30:
            return candidate
    return filtered_pool[0]


def _to_article_out(article: NormalizedArticle, bookmarked_ids: set[str]) -> NewsArticleOut:
    return NewsArticleOut(
        id=article.id,
        title=article.title,
        summary=article.summary,
        source=article.source,
        source_domain=article.source_domain,
        url=article.url,
        published_at=article.published_at,
        category=article.category,
        symbols=article.symbols,
        symbols_source=article.symbols_source,
        sentiment=article.sentiment,
        sentiment_score=article.sentiment_score,
        image_url=article.image_url,
        language=article.language,
        provider=article.provider,
        relevance_score=article.relevance_score,
        is_bookmarked=article.id in bookmarked_ids,
    )


def get_user_watchlist_symbols(db: Session, user_id: uuid.UUID) -> list[str]:
    symbols: list[str] = []
    stmt = (
        select(WatchlistItem.symbol)
        .where(WatchlistItem.user_id == user_id)
        .order_by(WatchlistItem.created_at.desc())
        .limit(12)
    )
    for raw in db.scalars(stmt).all():
        norm = normalize_provider_symbol(raw) or (raw or "").strip().upper()
        if norm and norm not in symbols:
            symbols.append(norm)

    if len(symbols) < 8:
        trade_stmt = (
            select(Trade.symbol)
            .where(Trade.user_id == user_id)
            .order_by(Trade.opened_at.desc())
            .limit(25)
        )
        for raw in db.scalars(trade_stmt).all():
            norm = normalize_provider_symbol(raw) or (raw or "").strip().upper()
            if norm and norm not in symbols:
                symbols.append(norm)
            if len(symbols) >= 8:
                break
    return symbols


def get_bookmarked_article_ids(db: Session, user_id: uuid.UUID) -> set[str]:
    stmt = select(NewsBookmark.article_id).where(NewsBookmark.user_id == user_id)
    return set(db.scalars(stmt).all())


def get_news_feed(
    db: Session,
    user: User,
    *,
    category: NewsCategory = "all",
    query: str | None = None,
    symbol: str | None = None,
    source: str | None = None,
    sentiment: NewsSentiment | None = None,
    date_range: NewsDateRange = "all",
    sort: NewsSort = "newest",
    page: int = 1,
    page_size: int = 20,
    force_refresh: bool = False,
) -> NewsFeedResponse:
    pool_entry, freshness = load_candidate_pool(category, query, force_refresh=force_refresh)

    available_sources = sorted({a.source for a in pool_entry.articles if a.source})
    sentiment_available = any(a.sentiment is not None for a in pool_entry.articles)

    filtered = _filter_and_sort_pool(
        pool_entry.articles,
        category=category,
        search_query=query,
        symbol=symbol,
        source=source,
        sentiment=sentiment,
        date_range=date_range,
        sort=sort,
    )

    bookmarked_ids = get_bookmarked_article_ids(db, user.id)
    watchlist_symbols = get_user_watchlist_symbols(db, user.id)

    featured_norm = select_featured_article(filtered)
    featured_out = _to_article_out(featured_norm, bookmarked_ids) if featured_norm is not None else None

    offset = (page - 1) * page_size
    page_slice = filtered[offset : offset + page_size]
    articles_out = [_to_article_out(item, bookmarked_ids) for item in page_slice]

    meta = NewsFeedMeta(
        candidate_count=len(filtered),
        page=page,
        page_size=page_size,
        has_more=(offset + page_size) < len(filtered),
        fetched_at=pool_entry.fetched_at,
        freshness=freshness,
        cache_ttl_seconds=max(30, int(settings.news_cache_ttl_seconds)),
        active_providers=pool_entry.active_providers,
        provider_status=pool_entry.provider_status,
        sentiment_available=sentiment_available,
        available_sources=available_sources[:40],
        watchlist_symbols=watchlist_symbols,
    )

    return NewsFeedResponse(
        featured=featured_out,
        articles=articles_out,
        meta=meta,
    )


def list_bookmarks(db: Session, user: User) -> list[NewsArticleOut]:
    stmt = (
        select(NewsBookmark)
        .where(NewsBookmark.user_id == user.id)
        .order_by(NewsBookmark.saved_at.desc())
    )
    rows = db.scalars(stmt).all()
    results: list[NewsArticleOut] = []
    for row in rows:
        cat = row.category if row.category in {
            "all", "forex", "crypto", "stocks", "indices", "commodities", "economy", "central_banks"
        } else "all"
        sent = row.sentiment if row.sentiment in {"positive", "negative", "neutral"} else None
        sym_src = row.symbols_source if row.symbols_source in {"provider", "contextual", "none"} else "none"
        results.append(
            NewsArticleOut(
                id=row.article_id,
                title=row.title,
                summary=row.summary,
                source=row.source,
                source_domain=row.source_domain,
                url=row.url,
                published_at=row.published_at,
                category=cat,  # type: ignore[arg-type]
                symbols=list(row.symbols or []),
                symbols_source=sym_src,  # type: ignore[arg-type]
                sentiment=sent,  # type: ignore[arg-type]
                sentiment_score=row.sentiment_score,
                image_url=None,
                language="en",
                provider=row.provider,
                relevance_score=0.0,
                is_bookmarked=True,
                saved_at=row.saved_at,
            )
        )
    return results


def save_bookmark(db: Session, user: User, payload: NewsBookmarkCreate) -> NewsArticleOut:
    url_info = validate_and_canonicalize_url(payload.url)
    if url_info is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid or unsafe article URL",
        )
    clean_url, _canonical, hostname = url_info

    clean_title = sanitize_text(payload.title, max_length=512)
    if not clean_title:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Article title is required",
        )
    clean_summary = sanitize_text(payload.summary, max_length=1000) or None
    clean_source = sanitize_text(payload.source, max_length=255) or hostname or "Financial News"
    clean_domain = sanitize_text(payload.source_domain or hostname, max_length=255) or hostname
    clean_article_id = sanitize_text(payload.article_id, max_length=64)
    if not clean_article_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid article_id",
        )

    pub_dt = parse_utc_timestamp(payload.published_at) or datetime.now(timezone.utc)
    clean_symbols = [
        s for s in (sanitize_text(sym, max_length=24).upper() for sym in payload.symbols[:12]) if s
    ]

    existing_stmt = select(NewsBookmark).where(
        NewsBookmark.user_id == user.id,
        NewsBookmark.article_id == clean_article_id,
    )
    row = db.scalar(existing_stmt)
    if row is None:
        row = NewsBookmark(
            user_id=user.id,
            article_id=clean_article_id,
            title=clean_title,
            summary=clean_summary,
            url=clean_url,
            source=clean_source,
            source_domain=clean_domain,
            published_at=pub_dt,
            category=payload.category,
            symbols=clean_symbols,
            symbols_source=payload.symbols_source,
            sentiment=payload.sentiment,
            sentiment_score=payload.sentiment_score,
            provider=sanitize_text(payload.provider, max_length=32) or "google_rss",
        )
        db.add(row)
    else:
        row.title = clean_title
        row.summary = clean_summary
        row.url = clean_url
        row.source = clean_source
        row.source_domain = clean_domain
        row.published_at = pub_dt
        row.category = payload.category
        row.symbols = clean_symbols
        row.symbols_source = payload.symbols_source
        row.sentiment = payload.sentiment
        row.sentiment_score = payload.sentiment_score

    db.commit()
    db.refresh(row)

    return NewsArticleOut(
        id=row.article_id,
        title=row.title,
        summary=row.summary,
        source=row.source,
        source_domain=row.source_domain,
        url=row.url,
        published_at=row.published_at,
        category=payload.category,
        symbols=list(row.symbols or []),
        symbols_source=payload.symbols_source,
        sentiment=payload.sentiment,
        sentiment_score=row.sentiment_score,
        image_url=None,
        language="en",
        provider=row.provider,
        relevance_score=0.0,
        is_bookmarked=True,
        saved_at=row.saved_at,
    )


def delete_bookmark(db: Session, user: User, article_id: str) -> None:
    clean_id = sanitize_text(article_id, max_length=64)
    stmt = select(NewsBookmark).where(
        NewsBookmark.user_id == user.id,
        NewsBookmark.article_id == clean_id,
    )
    row = db.scalar(stmt)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bookmark not found")
    db.delete(row)
    db.commit()
