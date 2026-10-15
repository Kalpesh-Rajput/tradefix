"""Versioned strategy definition. Unknown fields and out-of-range numbers are rejected."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.config import settings

SCHEMA_VERSION = 1
INDICATORS = ("sma", "ema", "rsi", "macd", "atr", "bollinger", "stochastic", "adx", "highest", "lowest")
OPERATORS = ("gt", "lt", "gte", "lte", "crosses_above", "crosses_below")


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Operand(_Strict):
    kind: Literal["price", "indicator", "constant"]
    field: Literal["open", "high", "low", "close"] | None = None
    offset: int = Field(default=0, ge=0, le=50)
    name: str | None = None
    period: int | None = None
    output: str | None = None
    value: float | None = None

    @model_validator(mode="after")
    def _matches_kind(self) -> "Operand":
        if self.kind == "price" and self.field is None:
            raise ValueError("A price operand needs a field")
        if self.kind == "constant" and self.value is None:
            raise ValueError("A constant operand needs a value")
        if self.kind == "indicator":
            if self.name not in INDICATORS:
                raise ValueError(f"Unknown indicator {self.name}")
            if self.period is None:
                raise ValueError("An indicator needs a period")
            if not settings.indicator_period_min <= self.period <= settings.indicator_period_max:
                raise ValueError("Indicator period is out of range")
        return self


class Condition(_Strict):
    left: Operand
    operator: Literal["gt", "lt", "gte", "lte", "crosses_above", "crosses_below"]
    right: Operand


class NestedGroup(_Strict):
    combine: Literal["all", "any"]
    conditions: list[Condition] = Field(default_factory=list)


class RuleGroup(_Strict):
    combine: Literal["all", "any"]
    conditions: list[Condition] = Field(default_factory=list)
    groups: list[NestedGroup] = Field(default_factory=list)


class StopLoss(_Strict):
    type: Literal["pips", "atr", "percent", "swing"]
    value: float = Field(gt=0)
    period: int | None = None


class TakeProfit(_Strict):
    type: Literal["r", "pips", "atr"]
    value: float = Field(gt=0)
    period: int | None = None


class Filters(_Strict):
    hours: list[int] = Field(default_factory=list)
    weekdays: list[int] = Field(default_factory=list)
    max_trades_per_day: int | None = Field(default=None, ge=1)
    min_bars_between: int = Field(default=0, ge=0)

    @model_validator(mode="after")
    def _ranges(self) -> "Filters":
        if any(hour < 0 or hour > 23 for hour in self.hours):
            raise ValueError("Hours are 0 to 23 UTC")
        if any(day < 0 or day > 6 for day in self.weekdays):
            raise ValueError("Weekdays are 0 (Monday) to 6 (Sunday)")
        return self


class Risk(_Strict):
    initial_balance: float = Field(gt=0)
    risk_percent: float | None = Field(default=None, gt=0, le=100)
    fixed_size: float | None = Field(default=None, gt=0)
    max_size: float | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def _one_size(self) -> "Risk":
        if (self.risk_percent is None) == (self.fixed_size is None):
            raise ValueError("Set either a risk percent or a fixed size")
        return self


class StrategyCosts(_Strict):
    spread_pips: float = Field(default=0, ge=0)
    commission_per_lot: float = Field(default=0, ge=0)
    slippage_pips: float = Field(default=0, ge=0)


class Market(_Strict):
    symbol: str = Field(min_length=3, max_length=32)
    timeframe: Literal["1m", "5m", "15m", "30m", "1h", "4h", "1d"]
    start_ms: int = Field(ge=0)
    end_ms: int = Field(ge=0)


class StrategyDefinition(_Strict):
    schema_version: Literal[1]
    name: str = Field(min_length=1, max_length=80)
    description: str = Field(default="", max_length=2000)
    market: Market
    direction: Literal["long", "short", "both"]
    long_entry: RuleGroup | None = None
    short_entry: RuleGroup | None = None
    stop_loss: StopLoss
    take_profit: TakeProfit
    max_bars: int | None = Field(default=None, ge=1, le=10000)
    exit_on_opposite: bool = False
    filters: Filters = Field(default_factory=Filters)
    risk: Risk
    costs: StrategyCosts = Field(default_factory=StrategyCosts)

    @model_validator(mode="after")
    def _limits(self) -> "StrategyDefinition":
        if self.market.end_ms <= self.market.start_ms:
            raise ValueError("The end must be after the start")
        if self.direction in ("long", "both") and self.long_entry is None:
            raise ValueError("A long entry is required")
        if self.direction in ("short", "both") and self.short_entry is None:
            raise ValueError("A short entry is required")
        conditions = _conditions(self.long_entry) + _conditions(self.short_entry)
        if len(conditions) > settings.strategy_max_conditions:
            raise ValueError(f"Use at most {settings.strategy_max_conditions} conditions")
        names = {operand.name for condition in conditions for operand in (condition.left, condition.right) if operand.kind == "indicator"}
        if len(names) > settings.strategy_max_indicators:
            raise ValueError(f"Use at most {settings.strategy_max_indicators} indicators")
        return self


def _conditions(group: RuleGroup | None) -> list[Condition]:
    if group is None:
        return []
    nested = [condition for child in group.groups for condition in child.conditions]
    return [*group.conditions, *nested]


def parse_strategy(payload: dict) -> StrategyDefinition:
    return StrategyDefinition.model_validate(payload)
