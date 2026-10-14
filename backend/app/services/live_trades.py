"""The only way application code reads journal trades.

Simulated trades (backtest "save to journal", D-005) carry `is_simulated = true` and must never appear in
analytics, lists, exports, AI context, RAG, or broker-sync matching. Every reader goes through these helpers
so the exclusion lives in one place. Pass `include_deleted=True` only where the caller filters deletion itself.
"""

from __future__ import annotations

import uuid

from sqlalchemy import ColumnElement, Select, select
from sqlalchemy.orm import Session

from app.models.trade import Trade

LIVE_TRADE_FILTER: ColumnElement[bool] = Trade.is_simulated.is_(False)


def live_scope(user_id: uuid.UUID, *, include_deleted: bool = False) -> list[ColumnElement[bool]]:
    """WHERE clauses for a user's live trades, for aggregate or column selects."""
    clauses = [Trade.user_id == user_id, LIVE_TRADE_FILTER]
    if not include_deleted:
        clauses.append(Trade.is_deleted.is_(False))
    return clauses


def live_trades(user_id: uuid.UUID, *, include_deleted: bool = False) -> Select[tuple[Trade]]:
    """`select(Trade)` restricted to a user's live trades."""
    return select(Trade).where(*live_scope(user_id, include_deleted=include_deleted))


def get_live_trade(db: Session, user_id: uuid.UUID, trade_id: uuid.UUID, *, include_deleted: bool = True) -> Trade | None:
    """Fetch one trade owned by the user, or None if missing, foreign, or simulated."""
    stmt = live_trades(user_id, include_deleted=include_deleted).where(Trade.id == trade_id)
    return db.scalars(stmt).first()
