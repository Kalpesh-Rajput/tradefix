"""Feature access hook (backtesting/01 section 9). Every new endpoint calls `check_feature` first.

Everyone is allowed today; limits come from configuration. A subscription system only needs to change
`is_allowed`.
"""

from __future__ import annotations

from typing import Callable

from fastapi import Depends

from app.api.deps import get_current_user
from app.models.user import User
from app.services.backtest.errors import BacktestError

FEATURES = frozenset(
    {
        "backtesting.replay",
        "backtesting.manual",
        "backtesting.automated",
        "market_data.read",
    }
)


def is_allowed(user: User, key: str) -> bool:
    return True


def check_feature(user: User, key: str) -> None:
    if key not in FEATURES:
        raise ValueError(f"unknown feature {key}")
    if not is_allowed(user, key):
        raise BacktestError("feature_not_allowed", "Your plan does not include this feature.")


def require_feature(key: str) -> Callable[..., User]:
    """FastAPI dependency: the authenticated user, after the feature check."""
    if key not in FEATURES:
        raise ValueError(f"unknown feature {key}")

    def dependency(current_user: User = Depends(get_current_user)) -> User:
        check_feature(current_user, key)
        return current_user

    return dependency
