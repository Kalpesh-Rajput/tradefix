"""Shared trading rules for manual sessions and automated runs (backtesting/03 sections 4 and 5).

Candle prices are bid. Spread is charged half on entry and half on exit. Slippage applies to
market and stop fills, in the adverse direction. When one candle can hit both the stop and the
target, the stop wins.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

Side = Literal["buy", "sell"]
OrderKind = Literal["market", "limit", "stop"]
ExitReason = Literal["tp", "sl", "manual", "session end", "end of data"]


@dataclass(frozen=True)
class InstrumentSpec:
    symbol: str
    asset_class: str
    pip_size: float
    contract_size: float
    quote_currency: str
    price_decimals: int = 5


@dataclass(frozen=True)
class Costs:
    spread_pips: float = 0.0
    commission_per_lot: float = 0.0
    slippage_pips: float = 0.0


@dataclass(frozen=True)
class Bar:
    time: int
    open: float
    high: float
    low: float
    close: float


@dataclass(frozen=True)
class OrderRequest:
    id: str
    side: Side
    kind: OrderKind
    size: float
    price: float | None = None
    sl: float | None = None
    tp: float | None = None


@dataclass(frozen=True)
class Action:
    at: int
    type: Literal["place", "cancel", "close"]
    order: OrderRequest | None = None
    order_id: str | None = None


@dataclass
class Fill:
    order_id: str
    time: int
    side: Side
    price: float
    raw_price: float
    size: float
    reason: str


@dataclass
class ClosedTrade:
    id: str
    side: Side
    size: float
    entry_time: int
    entry_price: float
    exit_time: int
    exit_price: float
    sl: float | None
    tp: float | None
    exit_reason: str
    pips: float
    r_multiple: float | None
    pnl: float
    pnl_currency: str
    commission: float


@dataclass
class SimResult:
    fills: list[Fill] = field(default_factory=list)
    trades: list[ClosedTrade] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    balance: float = 0.0

    @property
    def net_profit(self) -> float:
        return sum(trade.pnl for trade in self.trades)


@dataclass
class _Position:
    id: str
    side: Side
    size: float
    entry_price: float
    entry_time: int
    sl: float | None
    tp: float | None
    entry_commission: float


@dataclass
class _Pending:
    order: OrderRequest
    queued_market: bool = False


def units_for(size: float, instrument: InstrumentSpec) -> float:
    if instrument.asset_class == "crypto":
        return size
    return size * instrument.contract_size


def direction(side: Side) -> int:
    return 1 if side == "buy" else -1


def _worse(raw: float, side: Side, pip: float, costs: Costs, slipped: bool) -> float:
    half = costs.spread_pips * pip / 2
    slip = costs.slippage_pips * pip if slipped else 0.0
    if side == "buy":
        return raw + half + slip
    return raw - half - slip


def _pips(side: Side, entry: float, exit_price: float, pip: float) -> float:
    return direction(side) * (exit_price - entry) / pip


def _r_multiple(side: Side, entry: float, exit_price: float, sl: float | None) -> float | None:
    if sl is None:
        return None
    risk = direction(side) * (entry - sl)
    if risk <= 0:
        return None
    return direction(side) * (exit_price - entry) / risk


class RuleEngine:
    """Steps one bar at a time. Market orders placed on bar i fill at the open of bar i + 1."""

    def __init__(
        self,
        instrument: InstrumentSpec,
        costs: Costs,
        *,
        account_currency: str = "USD",
        initial_balance: float = 10_000.0,
        conversion_rate: float | None = None,
        close_at_end: str | None = None,
    ) -> None:
        self.instrument = instrument
        self.costs = costs
        self.account_currency = account_currency
        self.conversion_rate = conversion_rate
        self.close_at_end = close_at_end
        self.balance = initial_balance
        self._pending: list[_Pending] = []
        self._position: _Position | None = None
        self.fills: list[Fill] = []
        self.trades: list[ClosedTrade] = []
        self.warnings: list[str] = []

    def run(self, bars: list[Bar], actions: list[Action]) -> SimResult:
        grouped: dict[int, list[Action]] = {}
        for action in actions:
            grouped.setdefault(action.at, []).append(action)
        for index, bar in enumerate(bars):
            self._fill_markets(bar)
            self._trigger_pending(bar)
            self._protect(bar)
            for action in grouped.get(index, []):
                if action.type == "close":
                    self._close_at(bar, "manual", bar.close, slipped=True)
            for action in grouped.get(index, []):
                if action.type == "cancel":
                    self._cancel(action.order_id or "")
                elif action.type == "place" and action.order is not None:
                    self._place(action.order)
        if self._position is not None and self.close_at_end and bars:
            self._close_at(bars[-1], self.close_at_end, bars[-1].close, slipped=False)
        if any(trade.sl is None for trade in self.trades):
            self.warnings.append("no_stop")
        return SimResult(fills=list(self.fills), trades=list(self.trades), warnings=list(self.warnings), balance=self.balance)

    def _place(self, order: OrderRequest) -> None:
        if order.size <= 0:
            return
        if order.kind == "market":
            self._pending.append(_Pending(order, queued_market=True))
        else:
            self._pending.append(_Pending(order))

    def _cancel(self, order_id: str) -> None:
        self._pending = [item for item in self._pending if item.order.id != order_id]

    def _fill_markets(self, bar: Bar) -> None:
        ready = [item for item in self._pending if item.queued_market]
        self._pending = [item for item in self._pending if not item.queued_market]
        for item in ready:
            if self._position is not None:
                continue
            self._open(item.order, bar, bar.open, "market", slipped=True)

    def _trigger_pending(self, bar: Bar) -> None:
        still: list[_Pending] = []
        for item in self._pending:
            if item.queued_market or self._position is not None:
                still.append(item)
                continue
            raw = _trigger_price(item.order, bar)
            if raw is None:
                still.append(item)
                continue
            slipped = item.order.kind == "stop"
            self._open(item.order, bar, raw, item.order.kind, slipped=slipped)
        self._pending = still

    def _open(self, order: OrderRequest, bar: Bar, raw: float, reason: str, *, slipped: bool) -> None:
        price = _worse(raw, order.side, self.instrument.pip_size, self.costs, slipped)
        commission = self.costs.commission_per_lot * order.size
        self.fills.append(Fill(order.id, bar.time, order.side, price, raw, order.size, reason))
        self._position = _Position(order.id, order.side, order.size, price, bar.time, order.sl, order.tp, commission)

    def _protect(self, bar: Bar) -> None:
        position = self._position
        if position is None:
            return
        stop_raw = _stop_raw(position, bar)
        if stop_raw is not None:
            self._close_at(bar, "sl", stop_raw, slipped=True)
            return
        target_raw = _target_raw(position, bar)
        if target_raw is not None:
            self._close_at(bar, "tp", target_raw, slipped=False)

    def _close_at(self, bar: Bar, reason: str, raw: float, *, slipped: bool) -> None:
        position = self._position
        if position is None:
            return
        exit_side: Side = "sell" if position.side == "buy" else "buy"
        price = _worse(raw, exit_side, self.instrument.pip_size, self.costs, slipped)
        exit_commission = self.costs.commission_per_lot * position.size
        self.fills.append(Fill(position.id, bar.time, exit_side, price, raw, position.size, reason))
        trade = _settle(
            position,
            bar.time,
            price,
            reason,
            self.instrument,
            self.account_currency,
            self.conversion_rate,
            exit_commission,
            self.warnings,
        )
        self.trades.append(trade)
        self.balance += trade.pnl
        self._position = None


def _trigger_price(order: OrderRequest, bar: Bar) -> float | None:
    level = order.price
    if level is None:
        return None
    if order.side == "buy" and order.kind == "limit":
        if bar.low <= level:
            return bar.open if bar.open <= level else level
    elif order.side == "sell" and order.kind == "limit":
        if bar.high >= level:
            return bar.open if bar.open >= level else level
    elif order.side == "buy" and order.kind == "stop":
        if bar.high >= level:
            return bar.open if bar.open >= level else level
    elif order.side == "sell" and order.kind == "stop":
        if bar.low <= level:
            return bar.open if bar.open <= level else level
    return None


def _stop_raw(position: _Position, bar: Bar) -> float | None:
    if position.sl is None:
        return None
    if position.side == "buy" and bar.low <= position.sl:
        return bar.open if bar.open <= position.sl else position.sl
    if position.side == "sell" and bar.high >= position.sl:
        return bar.open if bar.open >= position.sl else position.sl
    return None


def _target_raw(position: _Position, bar: Bar) -> float | None:
    if position.tp is None:
        return None
    if position.side == "buy" and bar.high >= position.tp:
        return bar.open if bar.open >= position.tp else position.tp
    if position.side == "sell" and bar.low <= position.tp:
        return bar.open if bar.open <= position.tp else position.tp
    return None


def _quote_is_account(quote: str, account: str) -> bool:
    usd = {"USD", "USDT"}
    return quote == account or (quote in usd and account in usd)


def _settle(
    position: _Position,
    exit_time: int,
    exit_price: float,
    reason: str,
    instrument: InstrumentSpec,
    account_currency: str,
    conversion_rate: float | None,
    exit_commission: float,
    warnings: list[str],
) -> ClosedTrade:
    pip = instrument.pip_size
    qty = units_for(position.size, instrument)
    quote_pnl = direction(position.side) * (exit_price - position.entry_price) * qty
    commission = position.entry_commission + exit_commission
    if _quote_is_account(instrument.quote_currency, account_currency):
        pnl = quote_pnl - commission
        currency = account_currency
    elif conversion_rate is not None:
        pnl = quote_pnl * conversion_rate - commission
        currency = account_currency
    else:
        pnl = quote_pnl
        currency = instrument.quote_currency
        if "conversion_unavailable" not in warnings:
            warnings.append("conversion_unavailable")
    r_value = _r_multiple(position.side, position.entry_price, exit_price, position.sl)
    return ClosedTrade(
        id=position.id,
        side=position.side,
        size=position.size,
        entry_time=position.entry_time,
        entry_price=position.entry_price,
        exit_time=exit_time,
        exit_price=exit_price,
        sl=position.sl,
        tp=position.tp,
        exit_reason=reason,
        pips=_pips(position.side, position.entry_price, exit_price, pip),
        r_multiple=r_value,
        pnl=pnl,
        pnl_currency=currency,
        commission=commission,
    )
