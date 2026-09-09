"""Segment-aware trade P&L, risk, margin, and partial-fill aggregation.

Mirrors frontend/lib/tradeCalc.ts. Leverage affects margin only — never risk.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Iterable, Literal

from app.services.instruments import (
    default_contract_size,
    default_lot_size,
    default_pip_size,
    get_instrument,
    normalize_symbol,
    quote_currency,
)

EPS = 1e-8
DisplayStatus = Literal["open", "partially_closed", "closed"]


def pip_size(symbol: str) -> float:
    inst = get_instrument("forex", symbol)
    if inst and inst.pip_size:
        return float(inst.pip_size)
    return default_pip_size(symbol)


def _direction(side: object) -> int:
    value = side.value if hasattr(side, "value") else str(side)
    return 1 if value == "long" else -1


def _segment(asset_type: object) -> str:
    return asset_type.value if hasattr(asset_type, "value") else str(asset_type)


def _leverage(value: float | None) -> float:
    if value is None:
        return 1.0
    lev = float(value)
    return lev if lev >= 1 else 1.0


def _round2(n: float) -> float:
    return round(n, 2)


def forex_units(lots: float, symbol: str, contract_size: float | None = None) -> float:
    cs = float(contract_size) if contract_size and contract_size > 0 else default_contract_size("forex", symbol)
    return float(lots or 0) * cs


def position_value(
    *,
    asset_type: object,
    symbol: str,
    quantity: float,
    entry_price: float,
    contract_size: float | None = None,
    side: object = "long",
) -> float:
    qty = float(quantity or 0)
    entry = float(entry_price or 0)
    if qty <= 0 or entry <= 0:
        return 0.0
    seg = _segment(asset_type)
    if seg == "forex":
        return _round2(forex_units(qty, symbol, contract_size) * entry)
    if seg == "option":
        lot = float(contract_size) if contract_size and contract_size > 0 else default_lot_size(symbol)
        return _round2(qty * lot * entry)
    if seg == "future":
        cs = float(contract_size) if contract_size and contract_size > 0 else default_contract_size("future", symbol)
        return _round2(qty * entry * cs)
    return _round2(qty * entry)


def calculate_forex_margin(*, position_size: float, leverage: float | None) -> float:
    if position_size <= 0:
        return 0.0
    return _round2(position_size / _leverage(leverage))


def margin_used(
    *,
    asset_type: object,
    symbol: str,
    quantity: float,
    entry_price: float,
    leverage: float | None = None,
    contract_size: float | None = None,
) -> float | None:
    seg = _segment(asset_type)
    pos = position_value(
        asset_type=asset_type,
        symbol=symbol,
        quantity=quantity,
        entry_price=entry_price,
        contract_size=contract_size,
    )
    if pos <= 0:
        return None
    if seg == "forex":
        return calculate_forex_margin(position_size=pos, leverage=leverage)
    if seg == "crypto":
        return _round2(pos / _leverage(leverage))
    if seg == "future":
        inst = get_instrument("future", symbol)
        hint = inst.margin_hint if inst else None
        if hint and hint > 0:
            return _round2(float(hint) * float(quantity or 0))
        return None
    return None


def invested_amount(
    *,
    asset_type: object,
    symbol: str,
    quantity: float,
    entry_price: float,
    leverage: float | None = None,
    contract_size: float | None = None,
    side: object = "long",
) -> float:
    """Capital deployed snapshot. Not used as a Forex label."""
    seg = _segment(asset_type)
    pos = position_value(
        asset_type=asset_type,
        symbol=symbol,
        quantity=quantity,
        entry_price=entry_price,
        contract_size=contract_size,
        side=side,
    )
    if seg == "forex":
        return calculate_forex_margin(position_size=pos, leverage=leverage)
    if seg == "crypto":
        return _round2(pos / _leverage(leverage))
    if seg == "option":
        direction = _direction(side)
        return pos if direction > 0 else 0.0
    if seg == "future":
        m = margin_used(
            asset_type=asset_type,
            symbol=symbol,
            quantity=quantity,
            entry_price=entry_price,
            leverage=leverage,
            contract_size=contract_size,
        )
        return m if m is not None else pos
    return pos


def calculate_options_value(contracts: float, lot_size: float | None, premium: float) -> float:
    lot = float(lot_size) if lot_size and lot_size > 0 else 100.0
    return _round2(float(contracts or 0) * lot * float(premium or 0))


def calculate_crypto_position_value(quantity: float, entry_price: float) -> float:
    return _round2(float(quantity or 0) * float(entry_price or 0))


def calculate_equity_risk(*, side: object, quantity: float, entry_price: float, stop_loss: float | None) -> float | None:
    if stop_loss is None:
        return None
    sl = float(stop_loss)
    entry = float(entry_price or 0)
    qty = float(quantity or 0)
    if sl < 0 or entry <= 0 or qty <= 0:
        return None
    raw = (entry - sl) * qty if _direction(side) > 0 else (sl - entry) * qty
    return _round2(max(0.0, raw))


def calculate_forex_risk(
    *,
    side: object,
    symbol: str,
    lots: float,
    entry_price: float,
    stop_loss: float | None,
    contract_size: float | None = None,
) -> float | None:
    if stop_loss is None:
        return None
    sl = float(stop_loss)
    entry = float(entry_price or 0)
    qty = float(lots or 0)
    if sl < 0 or entry <= 0 or qty <= 0:
        return None
    distance = (entry - sl) if _direction(side) > 0 else (sl - entry)
    if distance <= 0:
        return 0.0
    units = forex_units(qty, symbol, contract_size)
    raw = distance * units
    quote = quote_currency(symbol)
    if quote != "USD" and entry:
        raw = raw / entry
    return _round2(raw)


def calculate_futures_risk(
    *,
    side: object,
    contracts: float,
    entry_price: float,
    stop_loss: float | None,
    contract_size: float | None = None,
    tick_size: float | None = None,
    tick_value: float | None = None,
    symbol: str = "",
) -> float | None:
    if stop_loss is None:
        return None
    sl = float(stop_loss)
    entry = float(entry_price or 0)
    qty = float(contracts or 0)
    if sl < 0 or entry <= 0 or qty <= 0:
        return None
    distance = (entry - sl) if _direction(side) > 0 else (sl - entry)
    if distance <= 0:
        return 0.0
    ts = float(tick_size) if tick_size and tick_size > 0 else 0.0
    tv = float(tick_value) if tick_value and tick_value > 0 else 0.0
    if ts > 0 and tv > 0:
        return _round2((distance / ts) * tv * qty)
    cs = float(contract_size) if contract_size and contract_size > 0 else default_contract_size("future", symbol)
    return _round2(distance * qty * cs)


def risk_from_stop(
    *,
    asset_type: object,
    symbol: str,
    quantity: float,
    entry_price: float,
    stop_loss: float | None,
    contract_size: float | None = None,
    side: object = "long",
    tick_size: float | None = None,
    tick_value: float | None = None,
) -> float | None:
    if stop_loss is None:
        return None
    seg = _segment(asset_type)
    if seg == "forex":
        return calculate_forex_risk(
            side=side,
            symbol=symbol,
            lots=quantity,
            entry_price=entry_price,
            stop_loss=stop_loss,
            contract_size=contract_size,
        )
    if seg == "future":
        return calculate_futures_risk(
            side=side,
            contracts=quantity,
            entry_price=entry_price,
            stop_loss=stop_loss,
            contract_size=contract_size,
            tick_size=tick_size,
            tick_value=tick_value,
            symbol=symbol,
        )
    if seg == "option":
        lot = float(contract_size) if contract_size and contract_size > 0 else default_lot_size(symbol)
        base = calculate_equity_risk(side=side, quantity=quantity, entry_price=entry_price, stop_loss=stop_loss)
        return None if base is None else _round2(base * lot)
    return calculate_equity_risk(side=side, quantity=quantity, entry_price=entry_price, stop_loss=stop_loss)


def calculate_exit_pnl(
    *,
    asset_type: object,
    symbol: str,
    side: object,
    quantity: float,
    entry_price: float,
    exit_price: float,
    contract_size: float | None = None,
) -> float:
    return gross_pnl(
        asset_type=asset_type,
        symbol=symbol,
        side=side,
        quantity=quantity,
        entry_price=entry_price,
        exit_price=exit_price,
        contract_size=contract_size,
    )


def gross_pnl(
    *,
    asset_type: object,
    symbol: str,
    side: object,
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
    seg = _segment(asset_type)
    if seg == "forex":
        units = forex_units(qty, symbol, contract_size)
        raw = (exit_p - entry) * units * direction
        quote = quote_currency(symbol)
        if quote != "USD" and exit_p:
            raw = raw / exit_p
        return raw
    if seg == "option":
        lot = float(contract_size) if contract_size and contract_size > 0 else default_lot_size(symbol)
        return (exit_p - entry) * qty * lot * direction
    if seg == "future":
        cs = float(contract_size) if contract_size and contract_size > 0 else default_contract_size("future", symbol)
        return (exit_p - entry) * qty * cs * direction
    return (exit_p - entry) * qty * direction


def sell_amount(
    *,
    asset_type: object,
    symbol: str,
    quantity: float,
    exit_price: float,
    contract_size: float | None = None,
) -> float:
    """Exit value (notional / proceeds). Not divided by leverage."""
    qty = float(quantity or 0)
    exit_p = float(exit_price or 0)
    if qty <= 0 or exit_p <= 0:
        return 0.0
    return position_value(
        asset_type=asset_type,
        symbol=symbol,
        quantity=qty,
        entry_price=exit_p,
        contract_size=contract_size,
    )


def display_status(remaining: float, sell_qty: float) -> DisplayStatus:
    if sell_qty <= EPS:
        return "open"
    if remaining > EPS:
        return "partially_closed"
    return "closed"


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
class ExitLegBreakdown:
    """Per-exit gross/fees/net using the same formula as calculate_exit_pnl."""

    quantity: float
    price: float
    fees: float
    gross: float
    net: float


@dataclass
class ExitPnlBreakdown:
    legs: list[ExitLegBreakdown]
    total_exited: float
    average_exit_price: float | None
    remaining: float
    realized_gross: float
    leg_fees: float
    trade_fees: float
    total_fees: float
    realized_net: float | None
    display_status: DisplayStatus


@dataclass
class TradeCalcResult:
    quantity: float
    entry_price: float
    sell_quantity: float
    exit_price: float | None
    invested_amount: float
    position_value: float
    margin_used: float | None
    premium_received: float | None
    total_sell_amount: float
    fees: float
    pnl: float | None
    risk_amount: float | None
    remaining_quantity: float
    is_close: bool
    is_profit: bool | None
    status: str
    display_status: DisplayStatus
    year: int
    month: int
    is_equity: bool
    fills: list[Fill] = field(default_factory=list)
    exit_legs: list[ExitLegBreakdown] = field(default_factory=list)
    realized_gross: float | None = None


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


def calculate_exit_pnl_breakdown(
    *,
    asset_type: object,
    symbol: str,
    side: object,
    entry_quantity: float,
    entry_price: float,
    exits: Iterable[Fill] | Iterable[tuple[float, float, float]],
    trade_fees: float = 0.0,
    contract_size: float | None = None,
) -> ExitPnlBreakdown:
    """Per-leg and aggregate exit P&L. Reuses calculate_exit_pnl; does not change formulas."""
    buy_qty = float(entry_quantity or 0)
    avg_entry = float(entry_price or 0)
    legs: list[ExitLegBreakdown] = []
    realized_gross = 0.0
    leg_fees_total = 0.0
    sell_qty = 0.0
    exit_pairs: list[tuple[float, float]] = []

    for item in exits:
        if isinstance(item, Fill):
            qty = float(item.quantity or 0)
            price = float(item.price or 0)
            fee = float(item.fees or 0)
        else:
            qty = float(item[0] or 0)
            price = float(item[1] or 0)
            fee = float(item[2] or 0) if len(item) > 2 else 0.0
        if qty <= 0 or price <= 0:
            continue
        gross = calculate_exit_pnl(
            asset_type=asset_type,
            symbol=symbol,
            side=side,
            quantity=qty,
            entry_price=avg_entry,
            exit_price=price,
            contract_size=contract_size,
        )
        legs.append(
            ExitLegBreakdown(
                quantity=qty,
                price=price,
                fees=fee,
                gross=gross,
                net=_round2(gross - fee),
            )
        )
        realized_gross += gross
        leg_fees_total += fee
        sell_qty += qty
        exit_pairs.append((qty, price))

    sell_qty = round(sell_qty, 8)
    remaining = round(buy_qty - sell_qty, 8)
    if remaining < 0 and remaining > -EPS:
        remaining = 0.0
    shown = display_status(remaining, sell_qty)
    trade_fee_amt = float(trade_fees or 0)
    total_fees = round(trade_fee_amt + leg_fees_total, 2)
    avg_exit = _weighted_avg(exit_pairs) if exit_pairs else None
    realized_net = _round2(realized_gross - total_fees) if legs else None
    return ExitPnlBreakdown(
        legs=legs,
        total_exited=sell_qty,
        average_exit_price=round(avg_exit, 6) if avg_exit else None,
        remaining=max(0.0, remaining),
        realized_gross=_round2(realized_gross) if legs else 0.0,
        leg_fees=round(leg_fees_total, 2),
        trade_fees=round(trade_fee_amt, 2),
        total_fees=total_fees,
        realized_net=realized_net,
        display_status=shown,
    )


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
    asset_type: object,
    symbol: str,
    side: object,
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
    tick_size: float | None = None,
    tick_value: float | None = None,
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
    shown = display_status(remaining, sell_qty)
    is_close = shown == "closed"
    status = "closed" if is_close else "open"

    pos = position_value(
        asset_type=asset_type,
        symbol=symbol,
        quantity=buy_qty,
        entry_price=avg_entry,
        contract_size=contract_size,
        side=side,
    )
    margin = margin_used(
        asset_type=asset_type,
        symbol=symbol,
        quantity=buy_qty,
        entry_price=avg_entry,
        leverage=leverage,
        contract_size=contract_size,
    )
    invested = invested_amount(
        asset_type=asset_type,
        symbol=symbol,
        quantity=buy_qty,
        entry_price=avg_entry,
        leverage=leverage,
        contract_size=contract_size,
        side=side,
    )
    premium_received = None
    if _segment(asset_type) == "option" and _direction(side) < 0:
        premium_received = pos

    total_sell = sell_amount(
        asset_type=asset_type,
        symbol=symbol,
        quantity=sell_qty,
        exit_price=avg_exit or 0,
        contract_size=contract_size,
    )

    leg_fees = sum(float(f.fees or 0) for f in working)
    total_fees = round(trade_fees + leg_fees, 2)

    breakdown = calculate_exit_pnl_breakdown(
        asset_type=asset_type,
        symbol=symbol,
        side=side,
        entry_quantity=buy_qty,
        entry_price=avg_entry,
        exits=exits,
        trade_fees=trade_fees,
        contract_size=contract_size,
    )
    # Preserve prior fee scope: trade fees + all fill fees (entry + exit), same as before.
    pnl: float | None = None
    if exits and avg_entry > 0:
        pnl = _round2(breakdown.realized_gross - total_fees)

    computed_risk = risk_from_stop(
        asset_type=asset_type,
        symbol=symbol,
        quantity=buy_qty,
        entry_price=avg_entry,
        stop_loss=stop_loss,
        contract_size=contract_size,
        side=side,
        tick_size=tick_size,
        tick_value=tick_value,
    )
    final_risk = float(risk_amount) if risk_amount is not None else computed_risk

    is_profit = None if pnl is None else pnl > 0
    asset_value = _segment(asset_type)

    return TradeCalcResult(
        quantity=buy_qty,
        entry_price=round(avg_entry, 6) if avg_entry else 0.0,
        sell_quantity=sell_qty,
        exit_price=round(avg_exit, 6) if avg_exit else None,
        invested_amount=invested,
        position_value=pos,
        margin_used=margin,
        premium_received=premium_received,
        total_sell_amount=total_sell,
        fees=total_fees,
        pnl=pnl,
        risk_amount=final_risk,
        remaining_quantity=max(0.0, remaining),
        is_close=is_close,
        is_profit=is_profit,
        status=status,
        display_status=shown,
        year=opened_at.year,
        month=opened_at.month,
        is_equity=asset_value == "stock",
        fills=working,
        exit_legs=breakdown.legs,
        realized_gross=breakdown.realized_gross if exits else None,
    )


# Back-compat aliases used by older call sites.
quantity_to_units = forex_units


def default_contract_size_for(symbol: str, asset_type: object = "forex") -> float:
    return default_contract_size(_segment(asset_type), symbol)
