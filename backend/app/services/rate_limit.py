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

# Calendar share GIF/sticker search
giphy_search_limiter = SlidingWindowRateLimiter(
    max_calls=60,
    window_seconds=3600,
    detail="Too many GIF searches. Please wait and try again.",
)

giphy_proxy_limiter = SlidingWindowRateLimiter(
    max_calls=120,
    window_seconds=3600,
    detail="Too many media requests. Please wait and try again.",
)


_ai_hourly: SlidingWindowRateLimiter | None = None
_ai_daily: SlidingWindowRateLimiter | None = None
_ai_hourly_max: int | None = None
_ai_daily_max: int | None = None


def check_ai_rate_limit(user_id: str) -> None:
    """Application-level AI quotas. Limits come from settings, not hardcoded callers."""
    from app.core.config import settings

    global _ai_hourly, _ai_daily, _ai_hourly_max, _ai_daily_max
    hourly_max = int(settings.ai_hourly_limit)
    daily_max = int(settings.ai_daily_limit)
    if _ai_hourly is None or _ai_hourly_max != hourly_max:
        _ai_hourly = SlidingWindowRateLimiter(
            max_calls=hourly_max,
            window_seconds=3600,
            detail="AI hourly limit reached. Please try again later.",
        )
        _ai_hourly_max = hourly_max
    if _ai_daily is None or _ai_daily_max != daily_max:
        _ai_daily = SlidingWindowRateLimiter(
            max_calls=daily_max,
            window_seconds=86400,
            detail="AI daily limit reached. Please try again tomorrow.",
        )
        _ai_daily_max = daily_max
    _ai_hourly.check(f"ai-hour:{user_id}")
    _ai_daily.check(f"ai-day:{user_id}")

