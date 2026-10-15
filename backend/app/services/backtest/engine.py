"""Automated strategy runner. Signals use only bars up to the one being closed."""

from __future__ import annotations

import math
from datetime import datetime, timezone

import numpy as np

from app.core.config import settings
from app.services.backtest.bar_loader import required_warmup
from app.services.backtest.indicators import adx, atr, bollinger, ema, highest, lowest, macd, rsi, sma, stochastic
from app.services.backtest.rules import (
    Action,
    Bar,
    Bracket,
    Costs,
    InstrumentSpec,
    OrderRequest,
    RuleEngine,
)
from app.services.backtest.strategy_schema import Condition, Operand, RuleGroup, StrategyDefinition


def run_strategy(
    definition: StrategyDefinition,
    bars: list[Bar],
    instrument: InstrumentSpec,
    *,
    trade_start_index: int = 0,
) -> RuleEngine:
    engine = RuleEngine(
        instrument,
        Costs(definition.costs.spread_pips, definition.costs.commission_per_lot, definition.costs.slippage_pips),
        initial_balance=definition.risk.initial_balance,
        close_at_end="end of data",
    )
    series = _series(definition, bars)
    highs = np.array([bar.high for bar in bars], dtype=float)
    lows = np.array([bar.low for bar in bars], dtype=float)
    closes = np.array([bar.close for bar in bars], dtype=float)
    atr_cache: dict[int, np.ndarray] = {}
    warmup = required_warmup(definition)
    last_fill = -10**9
    filled_days: dict[str, int] = {}
    for index, bar in enumerate(bars):
        before = engine.position.id if engine.position is not None else None
        if index >= max(warmup, trade_start_index):
            long_signal = definition.direction in ("long", "both") and _group_true(definition.long_entry, series, index)
            short_signal = definition.direction in ("short", "both") and _group_true(definition.short_entry, series, index)
            position = engine.position
            side = None
            closing = False
            if position is None and engine.pending_count == 0:
                if long_signal:
                    side = "buy"
                elif short_signal:
                    side = "sell"
            elif position is not None and definition.exit_on_opposite:
                if position.side == "buy" and short_signal:
                    side, closing = "sell", True
                elif position.side == "sell" and long_signal:
                    side, closing = "buy", True
            if side is not None:
                blocked = _block_reason(definition, bar, index, last_fill, bars, filled_days)
                if blocked:
                    _skip(engine, blocked)
                else:
                    action = _entry(definition, bars, side, instrument, index, highs, lows, closes, atr_cache)
                    if action is None:
                        _skip(engine, "invalid_stop")
                    else:
                        if closing:
                            engine.accept(Action(index, "close"))
                        engine.accept(action)
            if position is not None and definition.max_bars is not None and index - int(position.id.rsplit("-", 1)[-1]) >= definition.max_bars:
                engine.accept(Action(index, "close"))
        engine.step(bar)
        opened = engine.position
        if opened is not None and opened.id != before:
            last_fill = index
            day = datetime.fromtimestamp(opened.entry_time / 1000, timezone.utc).date().isoformat()
            filled_days[day] = filled_days.get(day, 0) + 1
    if engine.position is not None and bars:
        engine._close_at(bars[-1], "end of data", bars[-1].close, slipped=False)
    return engine


def _skip(engine: RuleEngine, reason: str) -> None:
    engine.skip_counts[reason] = engine.skip_counts.get(reason, 0) + 1


def _block_reason(definition: StrategyDefinition, bar: Bar, index: int, last_fill: int, bars: list[Bar], filled_days: dict[str, int]) -> str | None:
    """First reason a signal is blocked. Hours and weekdays use the signal bar's UTC open. The day cap uses the next bar, which is the fill."""
    filters = definition.filters
    moment = datetime.fromtimestamp(bar.time / 1000, timezone.utc)
    if filters.hours and moment.hour not in filters.hours:
        return "hours"
    if filters.weekdays and moment.weekday() not in filters.weekdays:
        return "weekdays"
    if index - last_fill < filters.min_bars_between:
        return "min_bars_between"
    if filters.max_trades_per_day is not None and index + 1 < len(bars):
        entry_day = datetime.fromtimestamp(bars[index + 1].time / 1000, timezone.utc).date().isoformat()
        if filled_days.get(entry_day, 0) >= filters.max_trades_per_day:
            return "max_trades_per_day"
    return None


def _entry(
    definition: StrategyDefinition,
    bars: list[Bar],
    side: str,
    instrument: InstrumentSpec,
    index: int,
    highs: np.ndarray,
    lows: np.ndarray,
    closes: np.ndarray,
    atr_cache: dict[int, np.ndarray],
) -> Action | None:
    stop = definition.stop_loss
    target = definition.take_profit
    pip = instrument.pip_size
    bracket = Bracket(
        min_distance=max(stop.min_distance_pips, settings.backtest_min_stop_pips) * pip,
        risk_money=(definition.risk.initial_balance * definition.risk.risk_percent / 100) if definition.risk.risk_percent is not None else None,
        max_size=definition.risk.max_size,
        contract_sized=instrument.asset_class != "crypto",
        contract_size=instrument.contract_size,
    )
    if stop.type == "pips":
        bracket = _replace(bracket, stop_offset=stop.value * pip)
    elif stop.type == "percent":
        bracket = _replace(bracket, stop_percent=stop.value)
    elif stop.type == "atr":
        value = _atr_at(atr_cache, highs, lows, closes, stop.period or 0, index)
        if value is None:
            return None
        bracket = _replace(bracket, stop_offset=value * stop.value)
    else:
        level = _swing(bars, index, stop.period or 0, side, stop.buffer_pips * pip)
        if level is None:
            return None
        bracket = _replace(bracket, stop_price=level)
    if target.type == "r":
        bracket = _replace(bracket, target_r=target.value)
    elif target.type == "pips":
        bracket = _replace(bracket, target_offset=target.value * pip)
    else:
        value = _atr_at(atr_cache, highs, lows, closes, target.period or 0, index)
        if value is None:
            return None
        bracket = _replace(bracket, target_offset=value * target.value)
    size = definition.risk.fixed_size or 0
    return Action(index, "place", OrderRequest(id=f"{side}-{index}", side=side, kind="market", size=size, bracket=bracket))


def _replace(bracket: Bracket, **changes) -> Bracket:
    data = bracket.__dict__.copy()
    data.update(changes)
    return Bracket(**data)


def _atr_at(cache: dict[int, np.ndarray], highs: np.ndarray, lows: np.ndarray, closes: np.ndarray, period: int, index: int) -> float | None:
    if period not in cache:
        cache[period] = atr(highs, lows, closes, period)
    value = float(cache[period][index])
    if not math.isfinite(value) or value <= 0:
        return None
    return value


def _swing(bars: list[Bar], index: int, period: int, side: str, buffer: float) -> float | None:
    start = index - period + 1
    if period < 1 or start < 0:
        return None
    window = bars[start : index + 1]
    if side == "buy":
        return min(bar.low for bar in window) - buffer
    return max(bar.high for bar in window) + buffer


def _all(definition: StrategyDefinition) -> list[Condition]:
    found: list[Condition] = []
    for group in (definition.long_entry, definition.short_entry):
        if group is None:
            continue
        found.extend(group.conditions)
        for child in group.groups:
            found.extend(child.conditions)
    return found


def _group_true(group: RuleGroup | None, series: dict, index: int) -> bool:
    if group is None or index <= 0:
        return False
    flags = [_condition(condition, series, index) for condition in group.conditions]
    flags.extend(_nested(child, series, index) for child in group.groups)
    if not flags:
        return False
    return all(flags) if group.combine == "all" else any(flags)


def _nested(group, series: dict, index: int) -> bool:
    flags = [_condition(condition, series, index) for condition in group.conditions]
    if not flags:
        return False
    return all(flags) if group.combine == "all" else any(flags)


def _condition(condition: Condition, series: dict, index: int) -> bool:
    left = _value(condition.left, series, index)
    right = _value(condition.right, series, index)
    prev_left = _value(condition.left, series, index - 1)
    prev_right = _value(condition.right, series, index - 1)
    if not all(np.isfinite(value) for value in (left, right)):
        return False
    op = condition.operator
    if op == "gt":
        return left > right
    if op == "lt":
        return left < right
    if op == "gte":
        return left >= right
    if op == "lte":
        return left <= right
    if not all(np.isfinite(value) for value in (prev_left, prev_right)):
        return False
    if op == "crosses_above":
        return prev_left <= prev_right and left > right
    return prev_left >= prev_right and left < right


def _value(operand: Operand, series: dict, index: int) -> float:
    if index < 0:
        return float("nan")
    if operand.kind == "constant":
        return float(operand.value or 0)
    if operand.kind == "price":
        column = series[f"price:{operand.field}"]
        at = index - operand.offset
        return float(column[at]) if at >= 0 else float("nan")
    column = series.get((operand.name, operand.period, operand.output or "value"))
    if column is None:
        return float("nan")
    at = index - operand.offset
    return float(column[at]) if 0 <= at < len(column) else float("nan")


def _series(definition: StrategyDefinition, bars: list[Bar]) -> dict:
    close = np.array([bar.close for bar in bars], dtype=float)
    high = np.array([bar.high for bar in bars], dtype=float)
    low = np.array([bar.low for bar in bars], dtype=float)
    open_ = np.array([bar.open for bar in bars], dtype=float)
    out: dict = {"price:open": open_, "price:high": high, "price:low": low, "price:close": close}
    for condition in _all(definition):
        for operand in (condition.left, condition.right):
            if operand.kind != "indicator" or operand.period is None or operand.name is None:
                continue
            key = (operand.name, operand.period, operand.output or "value")
            if key in out:
                continue
            out.update(_indicator(operand.name, operand.period, open_, high, low, close))
    return out


def _indicator(name: str, period: int, open_: np.ndarray, high: np.ndarray, low: np.ndarray, close: np.ndarray) -> dict:
    if name == "sma":
        return {("sma", period, "value"): sma(close, period)}
    if name == "ema":
        return {("ema", period, "value"): ema(close, period)}
    if name == "rsi":
        return {("rsi", period, "value"): rsi(close, period)}
    if name == "highest":
        return {("highest", period, "value"): highest(high, period)}
    if name == "lowest":
        return {("lowest", period, "value"): lowest(low, period)}
    if name == "atr":
        return {("atr", period, "value"): atr(high, low, close, period)}
    if name == "macd":
        lines = macd(close)
        return {("macd", period, output): lines[output] for output in ("line", "signal", "histogram")}
    if name == "bollinger":
        lines = bollinger(close, period)
        return {("bollinger", period, output): lines[output] for output in ("middle", "upper", "lower")}
    if name == "stochastic":
        lines = stochastic(high, low, close, period)
        return {("stochastic", period, output): lines[output] for output in ("k", "d")}
    lines = adx(high, low, close, period)
    return {("adx", period, output): lines[output] for output in ("adx", "plus_di", "minus_di")}
