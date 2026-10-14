"""Bounded LRU of aggregated candle windows (backtesting/02 section 9.2).

Only windows that were fully covered when read are cached; covered history is immutable, so another
process filling new data cannot make an entry stale. In-process writes still invalidate overlapping
entries (`invalidate`), which covers top-ups rewriting the current month.
"""

from __future__ import annotations

import threading
from collections import OrderedDict
from dataclasses import dataclass

from app.core.config import settings
from app.services.marketdata.candles import Candles


@dataclass(frozen=True)
class CacheKey:
    source: str
    symbol: str
    timeframe: str
    start_ms: int
    end_ms: int


class CandleCache:
    def __init__(self, max_entries: int | None = None) -> None:
        self.max_entries = max_entries or settings.candle_cache_max_entries
        self._items: OrderedDict[CacheKey, Candles] = OrderedDict()
        self._lock = threading.Lock()
        self.hits = 0
        self.misses = 0

    def get(self, key: CacheKey) -> Candles | None:
        with self._lock:
            value = self._items.get(key)
            if value is None:
                self.misses += 1
                return None
            self._items.move_to_end(key)
            self.hits += 1
            return value

    def put(self, key: CacheKey, value: Candles) -> None:
        with self._lock:
            self._items[key] = value
            self._items.move_to_end(key)
            while len(self._items) > self.max_entries:
                self._items.popitem(last=False)

    def invalidate(self, source: str, symbol: str, start_ms: int, end_ms: int) -> int:
        with self._lock:
            stale = [
                k for k in self._items
                if k.source == source and k.symbol == symbol and k.start_ms < end_ms and k.end_ms > start_ms
            ]
            for key in stale:
                del self._items[key]
            return len(stale)

    def clear(self) -> None:
        with self._lock:
            self._items.clear()

    def __len__(self) -> int:
        return len(self._items)


candle_cache = CandleCache()
