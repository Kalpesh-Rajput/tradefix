"""Every strategy-schema literal and optional field has an engine test or a golden scenario."""

from __future__ import annotations

import typing
from datetime import datetime, timezone

from app.services.backtest.engine import run_strategy
from app.services.backtest.rules import Bar, InstrumentSpec
from app.services.backtest.strategy_schema import (
    INDICATORS,
    Condition,
    Filters,
    Market,
    NestedGroup,
    Operand,
    Risk,
    RuleGroup,
    StopLoss,
    StrategyCosts,
    StrategyDefinition,
    TakeProfit,
    parse_strategy,
)
from tests.test_strategy_scenarios import test_strategy_scenarios_match_the_hand_values

INSTRUMENT = InstrumentSpec("BTCUSDT", "crypto", 0.01, 1, "USDT", 2)
MODELS = [StopLoss, TakeProfit, Filters, Risk, StrategyCosts, Market, StrategyDefinition, Operand, Condition, RuleGroup, NestedGroup]

ENGINE_OPTION_TESTS = {
    "StopLoss.type=pips": "test_pips_percent_risk_costs_and_min_distance",
    "StopLoss.type=atr": "scenario:11",
    "StopLoss.type=percent": "scenario:21",
    "StopLoss.type=swing": "scenario:13",
    "StopLoss.period": "scenario:11",
    "StopLoss.buffer_pips": "scenario:13",
    "StopLoss.min_distance_pips": "test_pips_percent_risk_costs_and_min_distance",
    "TakeProfit.type=r": "test_target_r_and_groups",
    "TakeProfit.type=pips": "scenario:11",
    "TakeProfit.type=atr": "scenario:15",
    "TakeProfit.period": "scenario:15",
    "Filters.hours": "scenario:19",
    "Filters.weekdays": "scenario:20",
    "Filters.max_trades_per_day": "scenario:17",
    "Filters.min_bars_between": "scenario:18",
    "Risk.risk_percent": "test_pips_percent_risk_costs_and_min_distance",
    "Risk.fixed_size": "scenario:11",
    "Risk.max_size": "test_pips_percent_risk_costs_and_min_distance",
    "StrategyCosts.spread_pips": "test_pips_percent_risk_costs_and_min_distance",
    "StrategyCosts.commission_per_lot": "test_pips_percent_risk_costs_and_min_distance",
    "StrategyCosts.slippage_pips": "test_pips_percent_risk_costs_and_min_distance",
    "Market.timeframe=1m": "test_timeframes_directions_and_indicators",
    "Market.timeframe=5m": "test_timeframes_directions_and_indicators",
    "Market.timeframe=15m": "test_timeframes_directions_and_indicators",
    "Market.timeframe=30m": "test_timeframes_directions_and_indicators",
    "Market.timeframe=1h": "test_timeframes_directions_and_indicators",
    "Market.timeframe=4h": "test_timeframes_directions_and_indicators",
    "Market.timeframe=1d": "test_timeframes_directions_and_indicators",
    "StrategyDefinition.schema_version=1": "test_timeframes_directions_and_indicators",
    "StrategyDefinition.description": "test_timeframes_directions_and_indicators",
    "StrategyDefinition.direction=long": "scenario:11",
    "StrategyDefinition.direction=short": "scenario:12",
    "StrategyDefinition.direction=both": "test_timeframes_directions_and_indicators",
    "StrategyDefinition.long_entry": "scenario:11",
    "StrategyDefinition.short_entry": "scenario:12",
    "StrategyDefinition.max_bars": "scenario:17",
    "StrategyDefinition.exit_on_opposite": "test_timeframes_directions_and_indicators",
    "StrategyDefinition.filters": "scenario:19",
    "StrategyDefinition.costs": "test_pips_percent_risk_costs_and_min_distance",
    "Operand.kind=price": "scenario:11",
    "Operand.kind=indicator": "test_timeframes_directions_and_indicators",
    "Operand.kind=constant": "scenario:11",
    "Operand.field=open": "test_timeframes_directions_and_indicators",
    "Operand.field=high": "test_timeframes_directions_and_indicators",
    "Operand.field=low": "test_timeframes_directions_and_indicators",
    "Operand.field=close": "scenario:11",
    "Operand.field": "scenario:11",
    "Operand.offset": "test_timeframes_directions_and_indicators",
    "Operand.name": "test_timeframes_directions_and_indicators",
    "Operand.period": "test_timeframes_directions_and_indicators",
    "Operand.output": "test_timeframes_directions_and_indicators",
    "Operand.value": "scenario:11",
    "Condition.operator=gt": "scenario:11",
    "Condition.operator=lt": "scenario:12",
    "Condition.operator=gte": "test_timeframes_directions_and_indicators",
    "Condition.operator=lte": "test_timeframes_directions_and_indicators",
    "Condition.operator=crosses_above": "test_timeframes_directions_and_indicators",
    "Condition.operator=crosses_below": "test_timeframes_directions_and_indicators",
    "RuleGroup.combine=all": "scenario:11",
    "RuleGroup.combine=any": "test_target_r_and_groups",
    "RuleGroup.conditions": "scenario:11",
    "RuleGroup.groups": "test_target_r_and_groups",
    "NestedGroup.combine=all": "test_target_r_and_groups",
    "NestedGroup.combine=any": "test_target_r_and_groups",
    "NestedGroup.conditions": "test_target_r_and_groups",
    **{f"indicator={name}": "test_timeframes_directions_and_indicators" for name in INDICATORS},
}


def _walk(annotation) -> list:
    origin = typing.get_origin(annotation)
    if origin is typing.Literal:
        return list(typing.get_args(annotation))
    found = []
    if origin is not None:
        for arg in typing.get_args(annotation):
            found.extend(_walk(arg))
    return found


def schema_options() -> set[str]:
    keys = set()
    for model in MODELS:
        for name, field in model.model_fields.items():
            for value in _walk(field.annotation):
                keys.add(f"{model.__name__}.{name}={value}")
            if not field.is_required():
                keys.add(f"{model.__name__}.{name}")
    keys.update(f"indicator={name}" for name in INDICATORS)
    return keys


def _bars() -> list[Bar]:
    start = datetime(2024, 6, 3, tzinfo=timezone.utc)
    closes = [100 + index for index in range(40)]
    return [Bar(int((start.timestamp() + index * 3600) * 1000), close, close + 1, close - 1, close) for index, close in enumerate(closes)]


def _body(**overrides):
    body = {
        "schema_version": 1,
        "name": "coverage",
        "description": "coverage",
        "market": {"symbol": "BTCUSDT", "timeframe": "1h", "start_ms": 0, "end_ms": 1},
        "direction": "long",
        "long_entry": {"combine": "all", "conditions": [
            {"left": {"kind": "price", "field": "close"}, "operator": "gt", "right": {"kind": "constant", "value": 0}}
        ]},
        "stop_loss": {"type": "pips", "value": 100000},
        "take_profit": {"type": "r", "value": 2},
        "risk": {"initial_balance": 10000, "fixed_size": 1},
        "costs": {"spread_pips": 0, "commission_per_lot": 0, "slippage_pips": 0},
    }
    body.update(overrides)
    return body


def test_pips_percent_risk_costs_and_min_distance():
    bars = _bars()
    priced = run_strategy(parse_strategy(_body(
        costs={"spread_pips": 2, "commission_per_lot": 1, "slippage_pips": 1},
        stop_loss={"type": "pips", "value": 100, "min_distance_pips": 50},
    )), bars, INSTRUMENT)
    assert priced.trades[0].entry_price > bars[1].open
    assert priced.trades[0].commission > 0
    sized = run_strategy(parse_strategy(_body(
        risk={"initial_balance": 10000, "risk_percent": 1, "max_size": 10},
        stop_loss={"type": "pips", "value": 100},
    )), bars, INSTRUMENT)
    assert sized.trades[0].size == 10
    skipped = run_strategy(parse_strategy(_body(stop_loss={"type": "pips", "value": 1, "min_distance_pips": 100})), bars, INSTRUMENT)
    assert skipped.trades == [] and skipped.skip_counts.get("invalid_stop", 0) >= 1


def test_target_r_and_groups():
    bars = _bars()
    engine = run_strategy(parse_strategy(_body(
        long_entry={
            "combine": "any",
            "conditions": [],
            "groups": [{"combine": "all", "conditions": [
                {"left": {"kind": "price", "field": "close"}, "operator": "gt", "right": {"kind": "constant", "value": 0}}
            ]}],
        },
        take_profit={"type": "r", "value": 2},
        stop_loss={"type": "pips", "value": 100},
    )), bars, INSTRUMENT)
    assert engine.trades[0].r_multiple is not None


def test_timeframes_directions_and_indicators():
    for timeframe in ("1m", "5m", "15m", "30m", "1h", "4h", "1d"):
        parse_strategy(_body(market={"symbol": "BTCUSDT", "timeframe": timeframe, "start_ms": 0, "end_ms": 1}))
    bars = _bars()
    both = run_strategy(parse_strategy(_body(
        direction="both",
        exit_on_opposite=True,
        short_entry={"combine": "all", "conditions": [
            {"left": {"kind": "price", "field": "close"}, "operator": "lt", "right": {"kind": "constant", "value": 0}}
        ]},
    )), bars, INSTRUMENT)
    assert both.trades or both.position is not None
    for name in INDICATORS:
        output = {"bollinger": "upper", "stochastic": "k", "adx": "adx", "macd": "line"}.get(name, "value")
        left = {"kind": "indicator", "name": name, "period": 5, "output": output, "offset": 1}
        for operator in ("gte", "lte", "crosses_above", "crosses_below"):
            run_strategy(parse_strategy(_body(long_entry={"combine": "all", "conditions": [
                {"left": left, "operator": operator, "right": {"kind": "price", "field": "open" if operator == "gte" else "high"}}
            ]})), bars, INSTRUMENT)
    for field in ("open", "high", "low"):
        run_strategy(parse_strategy(_body(long_entry={"combine": "all", "conditions": [
            {"left": {"kind": "price", "field": field, "offset": 1}, "operator": "gt", "right": {"kind": "constant", "value": 0}}
        ]})), bars, INSTRUMENT)


def test_every_schema_option_has_an_engine_test():
    assert schema_options() == set(ENGINE_OPTION_TESTS)
    test_strategy_scenarios_match_the_hand_values()
    test_pips_percent_risk_costs_and_min_distance()
    test_target_r_and_groups()
    test_timeframes_directions_and_indicators()
