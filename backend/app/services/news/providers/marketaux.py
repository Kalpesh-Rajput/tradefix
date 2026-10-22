"""Marketaux optional news enrichment adapter.

Active only when `NEWS_MARKETAUX_ENABLED=true` and `MARKETAUX_API_TOKEN` is configured.
Enforces an in-process daily quota guard (`MARKETAUX_DAILY_QUOTA`, default 95) and
never logs or exposes the API token.
"""

from __future__ import annotations

import logging
import threading
from datetime import datetime, timezone

import httpx

from app.core.config import settings
from app.schemas.news import NewsCategory
from app.services.news.cache import cache_store, provider_cache_key
from app.services.news.types import ProviderFetchResult, RawProviderArticle

logger = logging.getLogger(__name__)

_quota_lock = threading.Lock()
_quota_day: str = ""
_quota_used: int = 0


def reset_marketaux_quota() -> None:
    global _quota_day, _quota_used
    with _quota_lock:
        _quota_day = ""
        _quota_used = 0


def get_marketaux_quota_used() -> int:
    with _quota_lock:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        if _quota_day != today:
            return 0
        return _quota_used


def _try_consume_quota(limit: int) -> bool:
    global _quota_day, _quota_used
    if limit <= 0:
        return False
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    with _quota_lock:
        if _quota_day != today:
            _quota_day = today
            _quota_used = 0
        if _quota_used >= limit:
            return False
        _quota_used += 1
        return True


def build_marketaux_params(category: NewsCategory, search_query: str | None = None) -> dict[str, str]:
    params: dict[str, str] = {
        "language": "en",
        "must_have_entities": "true",
        "group_similar": "true",
    }
    if search_query and search_query.strip():
        params["search"] = search_query.strip()[:80]
        return params

    if category == "forex":
        params["entity_types"] = "currency"
    elif category == "crypto":
        params["entity_types"] = "cryptocurrency"
    elif category == "indices":
        params["entity_types"] = "index,etf"
    elif category == "stocks":
        params["entity_types"] = "equity"
    elif category == "commodities":
        params["search"] = "gold | crude oil | silver | commodities"
    elif category == "central_banks":
        params["search"] = '"Federal Reserve" | ECB | "Bank of England" | "Bank of Japan" | "interest rates"'
    elif category == "economy":
        params["search"] = "inflation | CPI | GDP | payrolls | Treasury yields"
    return params


def parse_marketaux_json(payload: object) -> list[RawProviderArticle]:
    if not isinstance(payload, dict):
        raise ValueError("Marketaux response must be a JSON object")
    rows = payload.get("data")
    if rows is None:
        return []
    if not isinstance(rows, list):
        raise ValueError("Marketaux data field must be a list")

    articles: list[RawProviderArticle] = []
    for item in rows:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        url = str(item.get("url") or "").strip()
        if not title or not url:
            continue

        description = str(item.get("description") or "").strip() or None
        snippet = str(item.get("snippet") or "").strip() or None
        summary = description or snippet
        source = str(item.get("source") or "").strip() or "Marketaux"
        published_at = str(item.get("published_at") or "").strip() or None
        uuid_val = str(item.get("uuid") or "").strip() or None
        image_url = str(item.get("image_url") or "").strip() or None
        language = str(item.get("language") or "en").strip()

        symbols: list[str] = []
        entity_types: list[str] = []
        sentiment_scores: list[float] = []

        entities = item.get("entities")
        if isinstance(entities, list):
            for ent in entities:
                if not isinstance(ent, dict):
                    continue
                sym = str(ent.get("symbol") or "").strip().upper()
                if sym and sym not in symbols:
                    symbols.append(sym)
                ent_type = str(ent.get("type") or "").strip().lower()
                if ent_type and ent_type not in entity_types:
                    entity_types.append(ent_type)
                raw_score = ent.get("sentiment_score")
                if raw_score is not None:
                    try:
                        sentiment_scores.append(float(raw_score))
                    except (TypeError, ValueError):
                        pass

        avg_sentiment = (
            sum(sentiment_scores) / len(sentiment_scores)
            if sentiment_scores
            else None
        )

        articles.append(
            RawProviderArticle(
                provider="marketaux",
                title=title,
                url=url,
                published_at=published_at,
                summary=summary,
                source=source,
                source_domain=source.lower().removeprefix("www.") if "." in source else None,
                external_id=uuid_val,
                image_url=image_url,
                language=language,
                provider_symbols=symbols,
                provider_entity_types=entity_types,
                provider_sentiment_score=avg_sentiment,
            )
        )
    return articles


def fetch_marketaux(
    category: NewsCategory,
    search_query: str | None = None,
    *,
    force_refresh: bool = False,
    client: httpx.Client | None = None,
) -> ProviderFetchResult:
    if not settings.news_marketaux_enabled:
        return ProviderFetchResult(
            provider="marketaux",
            enabled=False,
            healthy=False,
            status="disabled",
            detail="Disabled via NEWS_MARKETAUX_ENABLED",
        )

    token = (settings.marketaux_api_token or "").strip()
    if not token:
        return ProviderFetchResult(
            provider="marketaux",
            enabled=False,
            healthy=False,
            status="unconfigured",
            detail="Optional MARKETAUX_API_TOKEN not configured",
        )

    query_params = build_marketaux_params(category, search_query)
    sig = "&".join(f"{k}={v}" for k, v in sorted(query_params.items()))
    cache_key = provider_cache_key("marketaux", sig)
    ttl = max(60, int(settings.news_cache_ttl_seconds))

    if not force_refresh:
        cached, _ = cache_store.get_provider(cache_key, ttl)
        if cached is not None:
            return ProviderFetchResult(
                provider="marketaux",
                enabled=True,
                healthy=True,
                status="cached",
                articles=cached.articles,
            )

    daily_limit = int(settings.marketaux_daily_quota)
    if not _try_consume_quota(daily_limit):
        stale, _ = cache_store.get_provider(cache_key, ttl, allow_stale=True)
        return ProviderFetchResult(
            provider="marketaux",
            enabled=True,
            healthy=bool(stale),
            status="quota_exhausted",
            articles=stale.articles if stale else [],
            detail=f"Daily quota guard ({daily_limit} requests/day) reached",
        )

    owns = client is None
    http = client or httpx.Client(timeout=float(settings.news_provider_timeout_seconds), follow_redirects=True)
    try:
        base_url = settings.marketaux_base_url.rstrip("/")
        resp = http.get(
            f"{base_url}/news/all",
            params={**query_params, "api_token": token},
            headers={"User-Agent": "TradeFix/1.0"},
        )
        if resp.status_code in {402, 429}:
            stale, _ = cache_store.get_provider(cache_key, ttl, allow_stale=True)
            status_code = "quota_exhausted" if resp.status_code == 402 else "rate_limited"
            return ProviderFetchResult(
                provider="marketaux",
                enabled=True,
                healthy=False,
                status=status_code,
                articles=stale.articles if stale else [],
                detail=f"Marketaux HTTP {resp.status_code}",
            )
        if resp.status_code in {401, 403}:
            logger.warning("marketaux authentication rejected (status %s)", resp.status_code)
            return ProviderFetchResult(
                provider="marketaux",
                enabled=True,
                healthy=False,
                status="error",
                detail="Marketaux API token rejected or restricted",
            )
        resp.raise_for_status()
        parsed = parse_marketaux_json(resp.json())
        cache_store.put_provider(cache_key, parsed)
        return ProviderFetchResult(
            provider="marketaux",
            enabled=True,
            healthy=True,
            status="ok",
            articles=parsed,
        )
    except Exception as exc:
        # Never log `exc` string directly as httpx exceptions can include the request URL with api_token
        logger.warning("marketaux adapter failed: %s", type(exc).__name__)
        stale, _ = cache_store.get_provider(cache_key, ttl, allow_stale=True)
        return ProviderFetchResult(
            provider="marketaux",
            enabled=True,
            healthy=False,
            status="error",
            articles=stale.articles if stale else [],
            detail=f"Marketaux unavailable ({type(exc).__name__})",
        )
    finally:
        if owns:
            http.close()
