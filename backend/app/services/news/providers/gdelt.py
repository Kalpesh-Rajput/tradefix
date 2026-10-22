"""GDELT DOC 2.0 API provider adapter.

Uses GDELT's open `ArtList` JSON endpoint with a 5.5s minimum pacing guard and
shared upstream query caching so category switches do not trigger rate limits.
"""

from __future__ import annotations

import logging
import re
import threading
import time

import httpx

from app.core.config import settings
from app.schemas.news import NewsCategory
from app.services.news.cache import cache_store, provider_cache_key
from app.services.news.types import ProviderFetchResult, RawProviderArticle

logger = logging.getLogger(__name__)

# Broad macro/markets query shared across standard categories so switching tabs reuses the cached GDELT pool
_SHARED_MACRO_GDELT_QUERY = (
    '("Federal Reserve" OR "interest rates" OR "forex" OR "inflation" OR "central bank" '
    'OR "Bitcoin" OR "crude oil" OR "stock market" OR "Treasury yields") sourcelang:eng'
)

_gdelt_lock = threading.Lock()
_last_gdelt_call_mono: float = 0.0


def reset_gdelt_pacing() -> None:
    global _last_gdelt_call_mono
    with _gdelt_lock:
        _last_gdelt_call_mono = 0.0


def build_gdelt_query(category: NewsCategory, search_query: str | None = None) -> str:
    if search_query and search_query.strip():
        cleaned = re.sub(r'["()\\]+', " ", search_query.strip())
        cleaned = re.sub(r"\s+", " ", cleaned).strip()[:80]
        if cleaned:
            return f'"{cleaned}" (market OR trading OR forex OR economy OR stocks OR crypto) sourcelang:eng'
    return _SHARED_MACRO_GDELT_QUERY


def parse_gdelt_json(payload: object, *, max_items: int = 75) -> list[RawProviderArticle]:
    if not isinstance(payload, dict):
        raise ValueError("GDELT payload must be a JSON object")
    raw_list = payload.get("articles")
    if raw_list is None:
        return []
    if not isinstance(raw_list, list):
        raise ValueError("GDELT articles field must be a list")

    articles: list[RawProviderArticle] = []
    for row in raw_list:
        if not isinstance(row, dict):
            continue
        title = str(row.get("title") or "").strip()
        url = str(row.get("url") or "").strip()
        if not title or not url:
            continue
        domain = str(row.get("domain") or "").strip().lower().removeprefix("www.") or None
        seendate = str(row.get("seendate") or "").strip() or None
        socialimage = str(row.get("socialimage") or "").strip() or None
        lang = str(row.get("language") or "English").strip().lower()
        lang_code = "en" if lang.startswith("eng") or lang == "en" else lang[:2]

        articles.append(
            RawProviderArticle(
                provider="gdelt",
                title=title,
                url=url,
                published_at=seendate,
                summary=None,
                source=domain or "GDELT Global Wire",
                source_domain=domain,
                image_url=socialimage,
                language=lang_code,
            )
        )
        if len(articles) >= max_items:
            break
    return articles


def fetch_gdelt_doc(
    category: NewsCategory,
    search_query: str | None = None,
    *,
    force_refresh: bool = False,
    client: httpx.Client | None = None,
) -> ProviderFetchResult:
    global _last_gdelt_call_mono

    if not settings.news_gdelt_enabled:
        return ProviderFetchResult(
            provider="gdelt",
            enabled=False,
            healthy=False,
            status="disabled",
            detail="Disabled via NEWS_GDELT_ENABLED",
        )

    upstream_query = build_gdelt_query(category, search_query)
    cache_key = provider_cache_key("gdelt", upstream_query)
    ttl = max(60, int(settings.news_cache_ttl_seconds))

    if not force_refresh:
        cached, _ = cache_store.get_provider(cache_key, ttl)
        if cached is not None:
            return ProviderFetchResult(
                provider="gdelt",
                enabled=True,
                healthy=True,
                status="cached",
                articles=cached.articles,
            )

    min_interval = max(0.0, float(settings.news_gdelt_min_interval_seconds))
    with _gdelt_lock:
        now = time.monotonic()
        if _last_gdelt_call_mono > 0 and (now - _last_gdelt_call_mono) < min_interval:
            stale, _ = cache_store.get_provider(cache_key, ttl, allow_stale=True)
            return ProviderFetchResult(
                provider="gdelt",
                enabled=True,
                healthy=bool(stale),
                status="cached" if stale else "rate_limited",
                articles=stale.articles if stale else [],
                detail="Paced by GDELT 5.5s minimum interval guard",
            )
        _last_gdelt_call_mono = now

    owns = client is None
    http = client or httpx.Client(timeout=float(settings.news_provider_timeout_seconds), follow_redirects=True)
    try:
        resp = http.get(
            settings.gdelt_base_url,
            params={
                "query": upstream_query,
                "mode": "ArtList",
                "maxrecords": "75",
                "format": "json",
                "sort": "DateDesc",
                "timespan": "7d",
            },
            headers={"User-Agent": "TradeFix/1.0"},
        )
        if resp.status_code == 429:
            stale, _ = cache_store.get_provider(cache_key, ttl, allow_stale=True)
            return ProviderFetchResult(
                provider="gdelt",
                enabled=True,
                healthy=False,
                status="rate_limited",
                articles=stale.articles if stale else [],
                detail="GDELT upstream rate limit reached",
            )
        resp.raise_for_status()

        body_text = resp.text.strip()
        if body_text.lower().startswith("please limit requests"):
            stale, _ = cache_store.get_provider(cache_key, ttl, allow_stale=True)
            return ProviderFetchResult(
                provider="gdelt",
                enabled=True,
                healthy=False,
                status="rate_limited",
                articles=stale.articles if stale else [],
                detail="GDELT upstream rate limit notice",
            )

        payload = resp.json()
        parsed = parse_gdelt_json(payload)
        cache_store.put_provider(cache_key, parsed)
        return ProviderFetchResult(
            provider="gdelt",
            enabled=True,
            healthy=True,
            status="ok",
            articles=parsed,
        )
    except Exception as exc:
        logger.warning("gdelt adapter failed: %s", type(exc).__name__)
        stale, _ = cache_store.get_provider(cache_key, ttl, allow_stale=True)
        return ProviderFetchResult(
            provider="gdelt",
            enabled=True,
            healthy=False,
            status="error",
            articles=stale.articles if stale else [],
            detail=f"GDELT unavailable ({type(exc).__name__})",
        )
    finally:
        if owns:
            http.close()
