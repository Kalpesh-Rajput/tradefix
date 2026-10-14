"""Per-provider token buckets shared by every job and inline fetch in this process (backtesting/02 section 10).

D-019 keeps one market worker process, so the worker's buckets are the global provider budget. The API
process has its own Binance bucket for inline fills (D-017), capped further by the inline semaphore.
"""

from __future__ import annotations

import threading
import time
from typing import Callable

from app.core.config import settings


class TokenBucket:
    def __init__(
        self,
        rate_per_s: float,
        capacity: float | None = None,
        *,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        if rate_per_s <= 0:
            raise ValueError("rate must be positive")
        self.rate = rate_per_s
        self.capacity = capacity if capacity is not None else max(1.0, rate_per_s)
        self.clock = clock
        self.sleep = sleep
        self._tokens = self.capacity
        self._updated = clock()
        self._lock = threading.Lock()

    def _refill(self) -> None:
        now = self.clock()
        self._tokens = min(self.capacity, self._tokens + (now - self._updated) * self.rate)
        self._updated = now

    def try_acquire(self) -> bool:
        with self._lock:
            self._refill()
            if self._tokens >= 1:
                self._tokens -= 1
                return True
            return False

    def acquire(self) -> float:
        """Block until a token is available; returns the seconds waited."""
        waited = 0.0
        while True:
            with self._lock:
                self._refill()
                if self._tokens >= 1:
                    self._tokens -= 1
                    return waited
                wait = (1 - self._tokens) / self.rate
            self.sleep(wait)
            waited += wait


_buckets: dict[str, TokenBucket] = {}
_guard = threading.Lock()


def _rate(provider: str) -> float:
    return {
        "binance": settings.binance_requests_per_second,
        "dukascopy": settings.dukascopy_requests_per_second,
    }.get(provider, 1.0)


def bucket_for(provider: str) -> TokenBucket:
    with _guard:
        bucket = _buckets.get(provider)
        if bucket is None:
            bucket = _buckets[provider] = TokenBucket(_rate(provider))
        return bucket


def throttle_for(provider: str) -> Callable[[], None]:
    bucket = bucket_for(provider)

    def throttle() -> None:
        bucket.acquire()

    return throttle


def reset_buckets() -> None:
    with _guard:
        _buckets.clear()
