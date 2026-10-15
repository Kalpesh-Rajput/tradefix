"""Saved strategies and definition checks (backtesting 4B)."""

from __future__ import annotations

import uuid

from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.backtest import Strategy
from app.models.user import User
from app.services.backtest.errors import BacktestError, not_found
from app.services.backtest.strategy_schema import StrategyDefinition, parse_strategy
from app.services.marketdata.aggregation import TIMEFRAME_MINUTES
from app.services.marketdata.coverage import covered_ranges
from app.services.marketdata.read_api import enabled_instrument

MINUTE_MS = 60_000


def estimated_bars(definition: StrategyDefinition) -> int:
    step = TIMEFRAME_MINUTES[definition.market.timeframe] * MINUTE_MS
    return max(0, (definition.market.end_ms - definition.market.start_ms) // step)


def validate_definition(db: Session, payload: dict) -> dict:
    try:
        definition = parse_strategy(payload)
    except ValidationError as exc:
        return {
            "ok": False,
            "errors": [{"field": ".".join(str(part) for part in err["loc"]), "message": err["msg"]} for err in exc.errors()],
            "estimated_bars": None,
        }
    errors: list[dict[str, str]] = []
    bars = estimated_bars(definition)
    if bars > settings.backtest_max_bars_per_run:
        errors.append({"field": "market", "message": f"That range is about {bars} bars, above the {settings.backtest_max_bars_per_run} cap."})
    try:
        spec = enabled_instrument(definition.market.symbol.upper())
    except BacktestError as exc:
        errors.append({"field": "market.symbol", "message": exc.message})
        spec = None
    data_ready = False
    if spec is not None:
        ranges = covered_ranges(db, spec.symbol, spec.source)
        start, end = definition.market.start_ms, definition.market.end_ms
        data_ready = any(a <= start and end <= b for a, b in ranges)
    note = None if data_ready or spec is None else "Market data for this range will be prepared when the run starts."
    return {"ok": not errors, "errors": errors, "estimated_bars": bars, "data_ready": data_ready, "data_note": note}


def create_strategy(db: Session, user: User, payload: dict) -> Strategy:
    checked = validate_definition(db, payload)
    if not checked["ok"]:
        raise BacktestError("invalid_strategy", "The strategy needs changes.", details={"errors": checked["errors"]})
    total = db.scalar(select(func.count()).select_from(Strategy).where(Strategy.user_id == user.id)) or 0
    if total >= settings.backtest_max_strategies:
        raise BacktestError("quota_exceeded", f"You can keep up to {settings.backtest_max_strategies} strategies.")
    definition = parse_strategy(payload)
    row = Strategy(
        user_id=user.id,
        name=definition.name,
        description=definition.description,
        definition=definition.model_dump(),
        schema_version=definition.schema_version,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def list_strategies(db: Session, user: User) -> list[Strategy]:
    return list(db.scalars(select(Strategy).where(Strategy.user_id == user.id).order_by(Strategy.updated_at.desc())).all())


def get_strategy(db: Session, user: User, strategy_id: uuid.UUID) -> Strategy:
    row = db.get(Strategy, strategy_id)
    if row is None or row.user_id != user.id:
        raise not_found("Strategy")
    return row


def update_strategy(db: Session, user: User, strategy_id: uuid.UUID, payload: dict) -> Strategy:
    row = get_strategy(db, user, strategy_id)
    checked = validate_definition(db, payload)
    if not checked["ok"]:
        raise BacktestError("invalid_strategy", "The strategy needs changes.", details={"errors": checked["errors"]})
    definition = parse_strategy(payload)
    row.name = definition.name
    row.description = definition.description
    row.definition = definition.model_dump()
    row.schema_version = definition.schema_version
    db.commit()
    db.refresh(row)
    return row


def delete_strategy(db: Session, user: User, strategy_id: uuid.UUID) -> None:
    row = get_strategy(db, user, strategy_id)
    db.delete(row)
    db.commit()
