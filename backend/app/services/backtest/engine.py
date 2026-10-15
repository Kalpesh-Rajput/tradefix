"""Automated strategy runner. Signals use only bars up to the one being closed."""

from __future__ import annotations

from datetime import datetime, timezone

import numpy as np

from app.services.backtest.indicators import adx, atr, bollinger, ema, highest, lowest, macd, rsi, sma, stochastic
from app.services.backtest.rules import (
    Action,
    Bar,
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
    warmup = _warmup(definition)
    last_entry = -10**9
    for index, bar in enumerate(bars):
        if index >= max(warmup, trade_start_index) and _filters_allow(definition, bar, index, last_entry):
            long_signal = definition.direction in ("long", "both") and _group_true(definition.long_entry, series, index)
            short_signal = definition.direction in ("short", "both") and _group_true(definition.short_entry, series, index)
            position = engine.position
            if position is None and engine.pending_count == 0:
                if long_signal:
                    engine.accept(_entry(definition, bar, "buy", instrument, index))
                    last_entry = index
                elif short_signal:
                    engine.accept(_entry(definition, bar, "sell", instrument, index))
                    last_entry = index
            elif position is not None and definition.exit_on_opposite:
                if position.side == "buy" and short_signal:
                    engine.accept(Action(index, "close"))
                    engine.accept(_entry(definition, bar, "sell", instrument, index))
                    last_entry = index
                elif position.side == "sell" and long_signal:
                    engine.accept(Action(index, "close"))
                    engine.accept(_entry(definition, bar, "buy", instrument, index))
                    last_entry = index
            if position is not None and definition.max_bars is not None and index - int(position.id.rsplit("-", 1)[-1]) >= definition.max_bars:
                engine.accept(Action(index, "close"))
        engine.step(bar)
    if engine.position is not None and bars:
        engine._close_at(bars[-1], "end of data", bars[-1].close, slipped=False)
    return engine


def _entry(definition: StrategyDefinition, bar: Bar, side: str, instrument: InstrumentSpec, index: int) -> Action:
    stop = _stop(definition, bar.close, side, instrument)
    target = _target(definition, bar.close, side, stop, instrument)
    size = definition.risk.fixed_size
    if size is None and definition.risk.risk_percent is not None and stop is not None:
        distance = abs(bar.close - stop)
        risk_money = definition.risk.initial_balance * definition.risk.risk_percent / 100
        units = risk_money / distance if distance else 0
        size = units if instrument.asset_class == "crypto" else units / instrument.contract_size
    size = size or 0
    if definition.risk.max_size is not None:
        size = min(size, definition.risk.max_size)
    return Action(
        index,
        "place",
        OrderRequest(id=f"{side}-{index}", side=side, kind="market", size=size, sl=stop, tp=target),
    )


def _stop(definition: StrategyDefinition, price: float, side: str, instrument: InstrumentSpec) -> float | None:
    spec = definition.stop_loss
    sign = 1 if side == "buy" else -1
    if spec.type == "pips":
        return price - sign * spec.value * instrument.pip_size
    if spec.type == "percent":
        return price * (1 - sign * spec.value / 100)
    return price - sign * spec.value * instrument.pip_size


def _target(definition: StrategyDefinition, price: float, side: str, stop: float | None, instrument: InstrumentSpec) -> float | None:
    spec = definition.take_profit
    sign = 1 if side == "buy" else -1
    if spec.type == "r" and stop is not None:
        return price + sign * spec.value * abs(price - stop)
    if spec.type == "pips":
        return price + sign * spec.value * instrument.pip_size
    return price + sign * spec.value * instrument.pip_size


def _filters_allow(definition: StrategyDefinition, bar: Bar, index: int, last_entry: int) -> bool:
    filters = definition.filters
    if index - last_entry < filters.min_bars_between:
        return False
    moment = datetime.fromtimestamp(bar.time / 1000, timezone.utc)
    if filters.hours and moment.hour not in filters.hours:
        return False
    if filters.weekdays and moment.weekday() not in filters.weekdays:
        return False
    return True


def _warmup(definition: StrategyDefinition) -> int:
    periods = [operand.period or 0 for condition in _all(definition) for operand in (condition.left, condition.right)]
    return max(periods or [0])


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
