"""Apply journal fields, partial fills, and calculated totals onto a Trade."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.precheck_list import PrecheckList
from app.models.trade import ExecutionLegType, Trade, TradeExecution, TradeStatus
from app.models.trade_master import MasterCategory
from app.models.user import User
from app.schemas.trade import TradeCreate, TradeExecutionInput, TradeUpdate
from app.services.masters_service import upsert_master
from app.services.trade_calc import Fill, TradeCalcResult, calculate_trade, default_contract_size


JOURNAL_KEYS = (
    "session",
    "trade_type",
    "option_type",
    "analysis_timeframe",
    "entry_timeframe",
    "stop_loss",
    "entry_condition",
    "exit_condition",
    "leverage",
    "contract_size",
    "is_favourite",
    "mood",
    "strategy_name",
    "strategy_id",
    "precheck_list_id",
)


def _as_fills(executions: list[TradeExecutionInput] | None) -> list[Fill]:
    fills: list[Fill] = []
    for item in executions or []:
        fills.append(
            Fill(
                leg_type=item.leg_type.value if hasattr(item.leg_type, "value") else str(item.leg_type),
                quantity=float(item.quantity),
                price=float(item.price),
                executed_at=item.executed_at,
                fees=float(item.fees or 0),
                condition=item.condition,
                notes=item.notes,
            )
        )
    return fills


def executions_from_trade(trade: Trade) -> list[Fill]:
    fills: list[Fill] = []
    for row in list(trade.executions or []):
        fills.append(
            Fill(
                leg_type=row.leg_type.value if hasattr(row.leg_type, "value") else str(row.leg_type),
                quantity=float(row.quantity),
                price=float(row.price),
                executed_at=row.executed_at,
                fees=float(row.fees or 0),
                condition=row.condition,
                notes=row.notes,
            )
        )
    return fills


def replace_executions(trade: Trade, fills: list[Fill], opened_at: datetime) -> None:
    trade.executions.clear()
    last_exit_at = None
    for idx, fill in enumerate(fills):
        executed = fill.executed_at or opened_at
        if executed.tzinfo is None:
            executed = executed.replace(tzinfo=timezone.utc)
        if fill.leg_type == "exit":
            last_exit_at = executed
        trade.executions.append(
            TradeExecution(
                leg_type=ExecutionLegType.exit if fill.leg_type == "exit" else ExecutionLegType.entry,
                quantity=fill.quantity,
                price=fill.price,
                executed_at=executed,
                fees=fill.fees or 0,
                condition=fill.condition,
                notes=fill.notes,
                sort_order=idx,
            )
        )
    if last_exit_at and trade.status == TradeStatus.closed:
        trade.closed_at = last_exit_at


def apply_calc(trade: Trade, calc: TradeCalcResult) -> None:
    trade.quantity = calc.quantity
    trade.entry_price = calc.entry_price
    trade.sell_quantity = calc.sell_quantity
    trade.exit_price = calc.exit_price
    trade.invested_amount = calc.invested_amount
    trade.total_sell_amount = calc.total_sell_amount
    trade.fees = calc.fees
    trade.pnl = calc.pnl
    trade.risk_amount = calc.risk_amount
    trade.is_close = calc.is_close
    trade.status = calc.status
    trade.year = calc.year
    trade.month = calc.month
    trade.is_equity = calc.is_equity
    extra = dict(trade.extra or {})
    extra["is_profit"] = calc.is_profit
    extra["remaining_quantity"] = calc.remaining_quantity
    trade.extra = extra
    if calc.is_close and not trade.closed_at:
        exits = [f for f in calc.fills if f.leg_type == "exit" and f.executed_at]
        if exits:
            trade.closed_at = max(f.executed_at for f in exits if f.executed_at)
    if not calc.is_close:
        trade.closed_at = trade.closed_at if calc.sell_quantity > 0 else None


def _validate_precheck(db: Session, user_id: uuid.UUID, list_id: uuid.UUID | None) -> uuid.UUID | None:
    if not list_id:
        return None
    row = db.get(PrecheckList, list_id)
    if not row or row.user_id != user_id:
        return None
    return row.id


def remember_trade_masters(db: Session, user_id: uuid.UUID, trade: Trade) -> None:
    upsert_master(db, user_id, MasterCategory.symbol, trade.symbol)
    pairs = [
        (MasterCategory.session, trade.session),
        (MasterCategory.trade_type, trade.trade_type),
        (MasterCategory.timeframe, trade.analysis_timeframe),
        (MasterCategory.timeframe, trade.entry_timeframe),
        (MasterCategory.entry_condition, trade.entry_condition),
        (MasterCategory.exit_condition, trade.exit_condition),
        (MasterCategory.mood, trade.mood),
        (MasterCategory.strategy, trade.strategy_name or trade.setup_tag),
    ]
    for category, name in pairs:
        if name:
            upsert_master(db, user_id, category, name)


def compute_for_payload(
    *,
    asset_type,
    symbol: str,
    side,
    opened_at: datetime,
    payload: TradeCreate | TradeUpdate,
    existing: Trade | None = None,
    default_leverage: float | None = None,
    default_fees: float = 0.0,
) -> TradeCalcResult:
    executions = None
    if isinstance(payload, TradeCreate):
        executions = payload.executions
    elif payload.executions is not None:
        executions = payload.executions
    elif existing is not None:
        executions = None

    fills = _as_fills(executions) if executions else (executions_from_trade(existing) if existing and executions is None and isinstance(payload, TradeUpdate) and payload.executions is None else [])
    if isinstance(payload, TradeUpdate) and payload.executions is None and existing is not None:
        fills = executions_from_trade(existing)
        if payload.quantity is not None or payload.entry_price is not None or payload.exit_price is not None or payload.sell_quantity is not None:
            # Rebuild from scalar fields when executions were not sent.
            fills = []

    leverage = payload.leverage
    if leverage is None and existing is not None:
        leverage = float(existing.leverage) if existing.leverage is not None else None
    if leverage is None:
        leverage = default_leverage

    contract_size = payload.contract_size
    if contract_size is None and existing is not None:
        contract_size = float(existing.contract_size) if existing.contract_size is not None else None
    if contract_size is None:
        contract_size = default_contract_size(symbol)

    fees = payload.fees
    if fees is None:
        fees = float(existing.fees) if existing is not None else default_fees

    quantity = payload.quantity if payload.quantity is not None else (float(existing.quantity) if existing else None)
    entry_price = payload.entry_price if payload.entry_price is not None else (float(existing.entry_price) if existing else None)
    exit_price = payload.exit_price if payload.exit_price is not None else (float(existing.exit_price) if existing and existing.exit_price is not None else None)
    sell_quantity = payload.sell_quantity if payload.sell_quantity is not None else (
        float(existing.sell_quantity) if existing and existing.sell_quantity is not None else None
    )
    stop_loss = payload.stop_loss if payload.stop_loss is not None else (float(existing.stop_loss) if existing and existing.stop_loss is not None else None)
    risk_amount = payload.risk_amount if payload.risk_amount is not None else (
        float(existing.risk_amount) if existing and existing.risk_amount is not None else None
    )
    closed_at = payload.closed_at if payload.closed_at is not None else (existing.closed_at if existing else None)
    entry_condition = payload.entry_condition if payload.entry_condition is not None else (existing.entry_condition if existing else None)
    exit_condition = payload.exit_condition if payload.exit_condition is not None else (existing.exit_condition if existing else None)

    return calculate_trade(
        asset_type=asset_type,
        symbol=symbol,
        side=side,
        opened_at=opened_at,
        fills=fills or None,
        quantity=quantity,
        entry_price=entry_price,
        sell_quantity=sell_quantity,
        exit_price=exit_price,
        closed_at=closed_at,
        fees=0.0,
        stop_loss=stop_loss,
        risk_amount=risk_amount,
        leverage=leverage,
        contract_size=contract_size,
        entry_condition=entry_condition,
        exit_condition=exit_condition,
        brokerage=fees,
    )


def apply_journal_fields(trade: Trade, data: dict, db: Session, user: User) -> None:
    if "precheck_list_id" in data:
        data["precheck_list_id"] = _validate_precheck(db, user.id, data.get("precheck_list_id"))
    if "extra" in data and data["extra"] is not None:
        extra = dict(trade.extra or {})
        extra.update(data.pop("extra") or {})
        trade.extra = extra
    for key in JOURNAL_KEYS:
        if key in data:
            setattr(trade, key, data[key])
    if not trade.strategy_name and trade.setup_tag:
        trade.strategy_name = trade.setup_tag
    if trade.strategy_name and not trade.setup_tag:
        trade.setup_tag = trade.strategy_name
