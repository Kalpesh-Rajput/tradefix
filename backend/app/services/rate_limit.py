"""Simple in-process rate limiter for sensitive endpoints (avatar upload, etc.)."""

from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import HTTPException, status


class SlidingWindowRateLimiter:
    def __init__(self, max_calls: int, window_seconds: float, detail: str | None = None):
        self.max_calls = max_calls
        self.window_seconds = window_seconds
        self.detail = detail or "Too many attempts. Please wait and try again."
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> None:
        now = time.monotonic()
        window = self._hits[key]
        cutoff = now - self.window_seconds
        while window and window[0] < cutoff:
            window.popleft()
        if len(window) >= self.max_calls:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=self.detail,
            )
        window.append(now)


# 10 avatar uploads per user per hour
avatar_upload_limiter = SlidingWindowRateLimiter(
    max_calls=10,
    window_seconds=3600,
    detail="Too many upload attempts. Please wait and try again.",
)

# 30 recap screenshot uploads per user per hour
screenshot_upload_limiter = SlidingWindowRateLimiter(
    max_calls=30,
    window_seconds=3600,
    detail="Too many upload attempts. Please wait and try again.",
)

# 5 password changes per user per hour
password_change_limiter = SlidingWindowRateLimiter(
    max_calls=5,
    window_seconds=3600,
    detail="Too many password change attempts. Please wait and try again.",
)
