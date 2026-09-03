"""Trade P&L, invested amount, and partial-fill aggregation.

Forex uses contract-size / lot math (ported from the TradeFix app). Other
segments keep simple qty × price.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Iterable

from app.models.trade import AssetType, TradeSide, TradeStatus

LOT_QTY_MAX = 100.0
EPS = 1e-8


def normalize_symbol(symbol: str | None) -> str:
    return (symbol or "").upper().replace("/", "").replace("-", "").replace(" ", "")


def pip_size(symbol: str) -> float:
    s = normalize_symbol(symbol)
    if s.endswith("JPY") or s.startswith("XAU") or s.startswith("XAG"):
        return 0.01
    return 0.0001


def default_contract_size(symbol: str) -> float:
    s = normalize_symbol(symbol)
    if s.startswith("XAU"):
        return 100.0
    if s.startswith("XAG"):
        return 5000.0
    return 100_000.0


def quantity_to_units(quantity: float, symbol: str, contract_size: float | None = None) -> float:
    """Treat values ≤ 100 as lots; larger values as already-expanded units."""
    q = float(quantity or 0)
    cs = float(contract_size) if contract_size and contract_size > 0 else default_contract_size(symbol)
    if 0 < abs(q) <= LOT_QTY_MAX:
        return q * cs
    return q


def _direction(side: TradeSide | str) -> int:
    value = side.value if isinstance(side, TradeSide) else str(side)
    return 1 if value == "long" else -1


def _is_forex(asset_type: AssetType | str) -> bool:
    value = asset_type.value if isinstance(asset_type, AssetType) else str(asset_type)
    return value == "forex"


def invested_amount(
    *,
    asset_type: AssetType | str,
    symbol: str,
    quantity: float,
    entry_price: float,
    leverage: float | None = None,
    contract_size: float | None = None,
) -> float:
    qty = float(quantity or 0)
    entry = float(entry_price or 0)
    if qty <= 0 or entry <= 0:
        return 0.0
    if _is_forex(asset_type):
        units = quantity_to_units(qty, symbol, contract_size)
        notional = units * entry
        lev = float(leverage) if leverage and float(leverage) > 0 else 1.0
        return round(notional / lev, 2)
    return round(qty * entry, 2)


def sell_amount(
    *,
    asset_type: AssetType | str,
    symbol: str,
    quantity: float,
    exit_price: float,
    leverage: float | None = None,
    contract_size: float | None = None,
) -> float:
    qty = float(quantity or 0)
    exit_p = float(exit_price or 0)
    if qty <= 0 or exit_p <= 0:
        return 0.0
    if _is_forex(asset_type):
        units = quantity_to_units(qty, symbol, contract_size)
        notional = units * exit_p
        lev = float(leverage) if leverage and float(leverage) > 0 else 1.0
        return round(notional / lev, 2)
    return round(qty * exit_p, 2)


def gross_pnl(
    *,
    asset_type: AssetType | str,
    symbol: str,
    side: TradeSide | str,
    quantity: float,
    entry_price: float,
    exit_price: float,
    contract_size: float | None = None,
) -> float:
    qty = float(quantity or 0)
    entry = float(entry_price or 0)
    exit_p = float(exit_price or 0)
    if qty <= 0 or entry <= 0 or exit_p <= 0:
        return 0.0
    direction = _direction(side)
    if not _is_forex(asset_type):
        return (exit_p - entry) * qty * direction

    units = quantity_to_units(qty, symbol, contract_size)
    raw = (exit_p - entry) * units * direction
    s = normalize_symbol(symbol)
    quote = s[3:] if len(s) >= 6 else "USD"
    if quote == "JPY" and exit_p:
        raw = raw / exit_p
    return raw


def risk_from_stop(
    *,
    asset_type: AssetType | str,
    symbol: str,
    quantity: float,
    entry_price: float,
    stop_loss: float | None,
    contract_size: float | None = None,
) -> float | None:
    if stop_loss is None:
        return None
    sl = float(stop_loss)
    entry = float(entry_price or 0)
    qty = float(quantity or 0)
    if sl <= 0 or entry <= 0 or qty <= 0:
        return None
    distance = abs(entry - sl)
    if _is_forex(asset_type):
        units = quantity_to_units(qty, symbol, contract_size)
        s = normalize_symbol(symbol)
        quote = s[3:] if len(s) >= 6 else "USD"
        raw = distance * units
        if quote == "JPY" and entry:
            raw = raw / entry
        return round(raw, 2)
    return round(distance * qty, 2)


@dataclass
class Fill:
    leg_type: str  # entry | exit
    quantity: float
    price: float
    executed_at: datetime | None = None
    fees: float = 0.0
    condition: str | None = None
    notes: str | None = None


@dataclass
class TradeCalcResult:
    quantity: float
    entry_price: float
    sell_quantity: float
    exit_price: float | None
    invested_amount: float
    total_sell_amount: float
    fees: float
    pnl: float | None
    risk_amount: float | None
    remaining_quantity: float
    is_close: bool
    is_profit: bool | None
    status: TradeStatus
    year: int
    month: int
    is_equity: bool
    fills: list[Fill] = field(default_factory=list)


def _weighted_avg(qty_price: Iterable[tuple[float, float]]) -> float:
    total_qty = 0.0
    total_val = 0.0
    for qty, price in qty_price:
        q = float(qty or 0)
        p = float(price or 0)
        if q <= 0 or p <= 0:
            continue
        total_qty += q
        total_val += q * p
    if total_qty <= 0:
        return 0.0
    return total_val / total_qty


def synthesize_fills(
    *,
    quantity: float,
    entry_price: float,
    opened_at: datetime,
    sell_quantity: float | None = None,
    exit_price: float | None = None,
    closed_at: datetime | None = None,
    entry_condition: str | None = None,
    exit_condition: str | None = None,
    fees: float = 0.0,
) -> list[Fill]:
    fills = [
        Fill(
            leg_type="entry",
            quantity=float(quantity or 0),
            price=float(entry_price or 0),
            executed_at=opened_at,
            fees=0.0,
            condition=entry_condition,
        )
    ]
    sell_qty = float(sell_quantity) if sell_quantity is not None else (float(quantity or 0) if exit_price else 0.0)
    if exit_price and sell_qty > 0:
        fills.append(
            Fill(
                leg_type="exit",
                quantity=sell_qty,
                price=float(exit_price),
                executed_at=closed_at or opened_at,
                fees=float(fees or 0),
                condition=exit_condition,
            )
        )
    elif fees:
        fills[0].fees = float(fees or 0)
    return fills


def calculate_trade(
    *,
    asset_type: AssetType | str,
    symbol: str,
    side: TradeSide | str,
    opened_at: datetime,
    fills: list[Fill] | None = None,
    quantity: float | None = None,
    entry_price: float | None = None,
    sell_quantity: float | None = None,
    exit_price: float | None = None,
    closed_at: datetime | None = None,
    fees: float = 0.0,
    stop_loss: float | None = None,
    risk_amount: float | None = None,
    leverage: float | None = None,
    contract_size: float | None = None,
    entry_condition: str | None = None,
    exit_condition: str | None = None,
    brokerage: float | None = None,
) -> TradeCalcResult:
    trade_fees = float(brokerage if brokerage is not None else fees or 0)
    working = list(fills or [])
    if not working:
        working = synthesize_fills(
            quantity=float(quantity or 0),
            entry_price=float(entry_price or 0),
            opened_at=opened_at,
            sell_quantity=sell_quantity,
            exit_price=exit_price,
            closed_at=closed_at,
            entry_condition=entry_condition,
            exit_condition=exit_condition,
            fees=0.0,
        )

    entries = [f for f in working if f.leg_type == "entry" and float(f.quantity or 0) > 0]
    exits = [f for f in working if f.leg_type == "exit" and float(f.quantity or 0) > 0]

    buy_qty = round(sum(float(f.quantity) for f in entries), 8)
    sell_qty = round(sum(float(f.quantity) for f in exits), 8)
    avg_entry = _weighted_avg((f.quantity, f.price) for f in entries)
    avg_exit = _weighted_avg((f.quantity, f.price) for f in exits) if exits else None

    remaining = round(buy_qty - sell_qty, 8)
    if remaining < 0 and remaining > -EPS:
        remaining = 0.0
    is_close = remaining <= EPS and sell_qty > 0
    status = TradeStatus.closed if is_close else TradeStatus.open

    invested = invested_amount(
        asset_type=asset_type,
        symbol=symbol,
        quantity=buy_qty,
        entry_price=avg_entry,
        leverage=leverage,
        contract_size=contract_size,
    )
    total_sell = sell_amount(
        asset_type=asset_type,
        symbol=symbol,
        quantity=sell_qty,
        exit_price=avg_exit or 0,
        leverage=leverage,
        contract_size=contract_size,
    )

    leg_fees = sum(float(f.fees or 0) for f in working)
    total_fees = round(trade_fees + leg_fees, 2)

    pnl: float | None = None
    if exits and avg_entry > 0:
        realized = 0.0
        for ex in exits:
            realized += gross_pnl(
                asset_type=asset_type,
                symbol=symbol,
                side=side,
                quantity=float(ex.quantity),
                entry_price=avg_entry,
                exit_price=float(ex.price),
                contract_size=contract_size,
            )
        pnl = round(realized - total_fees, 2)

    computed_risk = risk_from_stop(
        asset_type=asset_type,
        symbol=symbol,
        quantity=buy_qty,
        entry_price=avg_entry,
        stop_loss=stop_loss,
        contract_size=contract_size,
    )
    final_risk = float(risk_amount) if risk_amount is not None else computed_risk

    is_profit = None if pnl is None else pnl > 0
    asset_value = asset_type.value if isinstance(asset_type, AssetType) else str(asset_type)

    return TradeCalcResult(
        quantity=buy_qty,
        entry_price=round(avg_entry, 6) if avg_entry else 0.0,
        sell_quantity=sell_qty,
        exit_price=round(avg_exit, 6) if avg_exit else None,
        invested_amount=invested,
        total_sell_amount=total_sell,
        fees=total_fees,
        pnl=pnl,
        risk_amount=final_risk,
        remaining_quantity=max(0.0, remaining),
        is_close=is_close,
        is_profit=is_profit,
        status=status,
        year=opened_at.year,
        month=opened_at.month,
        is_equity=asset_value == "stock",
        fills=working,
    )
