"""Two-tier caching for upstream provider responses and normalized candidate pools.

Tier 1: Upstream provider cache keyed by `provider_cache_key(provider_id, upstream_query_signature)`.
        Reuses upstream results only when the upstream query signature matches.
Tier 2: Normalized candidate pool cache keyed by `pool_cache_key(category, search_query, enabled_providers)`.
        Stores deduplicated `NormalizedArticle` pools with `_last_good` stale fallback and per-key single-flight locks.
"""

from __future__ import annotations

import re
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone

from app.schemas.news import NewsCategory, NewsFreshness, ProviderHealthStatus
from app.services.news.types import NormalizedArticle, RawProviderArticle

_WS_RE = re.compile(r"\s+")


def normalize_query_signature(value: str | None) -> str:
    if not value:
        return ""
    return _WS_RE.sub(" ", value.strip().lower())[:160]


def provider_cache_key(provider_id: str, upstream_query_signature: str) -> str:
    sig = normalize_query_signature(upstream_query_signature) or "_default_"
    return f"provider:{provider_id.strip().lower()}:{sig}"


def pool_cache_key(
    category: NewsCategory,
    search_query: str | None,
    enabled_providers: tuple[str, ...],
) -> str:
    q_sig = normalize_query_signature(search_query) or "_none_"
    prov_sig = ",".join(sorted(p.strip().lower() for p in enabled_providers if p)) or "none"
    return f"pool:{category}:{q_sig}:{prov_sig}"


@dataclass
class ProviderCacheEntry:
    fetched_mono: float
    fetched_at: datetime
    articles: list[RawProviderArticle]


@dataclass
class CandidatePoolEntry:
    fetched_mono: float
    fetched_at: datetime
    articles: list[NormalizedArticle]
    provider_status: list[ProviderHealthStatus] = field(default_factory=list)
    active_providers: list[str] = field(default_factory=list)


class NewsCacheStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._provider_fresh: dict[str, ProviderCacheEntry] = {}
        self._provider_last_good: dict[str, ProviderCacheEntry] = {}
        self._pool_fresh: dict[str, CandidatePoolEntry] = {}
        self._pool_last_good: dict[str, CandidatePoolEntry] = {}
        self._flight_locks: dict[str, threading.Lock] = {}

    def flight_lock_for(self, key: str) -> threading.Lock:
        with self._lock:
            lock = self._flight_locks.get(key)
            if lock is None:
                lock = threading.Lock()
                self._flight_locks[key] = lock
            return lock

    def get_provider(self, key: str, ttl_seconds: float, *, allow_stale: bool = False) -> tuple[ProviderCacheEntry | None, NewsFreshness | None]:
        now = time.monotonic()
        with self._lock:
            entry = self._provider_fresh.get(key)
            if entry is not None and (now - entry.fetched_mono) < max(1.0, ttl_seconds):
                return entry, "cached"
            if allow_stale:
                stale = self._provider_last_good.get(key)
                if stale is not None:
                    return stale, "stale"
        return None, None

    def put_provider(self, key: str, articles: list[RawProviderArticle]) -> ProviderCacheEntry:
        entry = ProviderCacheEntry(
            fetched_mono=time.monotonic(),
            fetched_at=datetime.now(timezone.utc),
            articles=list(articles),
        )
        with self._lock:
            self._provider_fresh[key] = entry
            if articles:
                self._provider_last_good[key] = entry
        return entry

    def get_pool(self, key: str, ttl_seconds: float) -> CandidatePoolEntry | None:
        now = time.monotonic()
        with self._lock:
            entry = self._pool_fresh.get(key)
            if entry is not None and (now - entry.fetched_mono) < max(1.0, ttl_seconds):
                return entry
        return None

    def get_stale_pool(self, key: str) -> CandidatePoolEntry | None:
        with self._lock:
            return self._pool_last_good.get(key)

    def put_pool(
        self,
        key: str,
        articles: list[NormalizedArticle],
        provider_status: list[ProviderHealthStatus],
        active_providers: list[str],
    ) -> CandidatePoolEntry:
        entry = CandidatePoolEntry(
            fetched_mono=time.monotonic(),
            fetched_at=datetime.now(timezone.utc),
            articles=list(articles),
            provider_status=list(provider_status),
            active_providers=list(active_providers),
        )
        with self._lock:
            self._pool_fresh[key] = entry
            if articles:
                self._pool_last_good[key] = entry
        return entry

    def reset(self) -> None:
        with self._lock:
            self._provider_fresh.clear()
            self._provider_last_good.clear()
            self._pool_fresh.clear()
            self._pool_last_good.clear()
            self._flight_locks.clear()


cache_store = NewsCacheStore()
