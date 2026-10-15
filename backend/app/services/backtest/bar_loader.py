"""Load aggregated candles for a strategy run, including indicator warm-up (spec 03 sections 5.3 and 9)."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.config import settings
from app.services.backtest.rules import Bar
from app.services.backtest.strategy_schema import StrategyDefinition
from app.services.marketdata.aggregation import timeframe_ms
from app.services.marketdata.candle_service import get_candles
from app.services.marketdata.registry import InstrumentSpec

# Bars required before the indicator's first finite value. MACD in indicators.py always uses 12/26/9.
_MACD_BARS = 26 + 9
_STOCHASTIC_SMOOTH = 3


def _indicator_bars(name: str, period: int) -> int:
    if name == "macd":
        return max(period, _MACD_BARS)
    if name == "rsi":
        return period + 1
    if name == "adx":
        return period * 2
    if name == "stochastic":
        return period + _STOCHASTIC_SMOOTH - 1
    return period


def required_warmup(definition: StrategyDefinition) -> int:
    """Longest lookback the definition can read, in bars of the strategy timeframe."""
    lookbacks = [0]
    for condition in _conditions(definition):
        for operand in (condition.left, condition.right):
            if operand.kind == "indicator" and operand.period is not None and operand.name is not None:
                lookbacks.append(_indicator_bars(operand.name, operand.period) + operand.offset)
            elif operand.kind == "price":
                lookbacks.append(operand.offset)
    stop = definition.stop_loss
    if stop.type == "atr" and stop.period:
        lookbacks.append(stop.period)
    if stop.type == "swing":
        lookbacks.append(stop.period or int(stop.value))
    target = definition.take_profit
    if target.type == "atr" and target.period:
        lookbacks.append(target.period)
    return max(lookbacks)


def _conditions(definition: StrategyDefinition):
    found = []
    for group in (definition.long_entry, definition.short_entry):
        if group is None:
            continue
        found.extend(group.conditions)
        for child in group.groups:
            found.extend(child.conditions)
    return found


@dataclass(frozen=True)
class LoadedBars:
    bars: list[Bar]
    trade_start_index: int
    first_bar_ms: int | None
    last_bar_ms: int | None

    @property
    def range_count(self) -> int:
        if self.first_bar_ms is None:
            return 0
        return len(self.bars) - self.trade_start_index


def load_strategy_bars(
    db: Session,
    spec: InstrumentSpec,
    timeframe: str,
    start_ms: int,
    end_ms: int,
    *,
    warmup_bars: int,
) -> LoadedBars:
    """Closed, covered candles from `warmup_bars` before `start_ms` through `end_ms`, in request-sized chunks."""
    step = timeframe_ms(timeframe)
    window_start = max(0, start_ms - warmup_bars * step)
    cap = settings.candle_max_bars_per_request
    bars: list[Bar] = []
    cursor = window_start
    guard = 0
    while cursor < end_ms:
        guard += 1
        if guard > settings.backtest_max_bars_per_run:
            break
        chunk_end = min(end_ms, cursor + cap * step)
        if chunk_end <= cursor:
            break
        window = get_candles(db, spec, timeframe, cursor, chunk_end, max_bars=cap)
        bars.extend(_to_bars(window.candles))
        cursor = chunk_end
    bars = _dedupe(bars)
    trade_start = next((index for index, bar in enumerate(bars) if bar.time >= start_ms), len(bars))
    in_range = bars[trade_start:]
    return LoadedBars(
        bars=bars,
        trade_start_index=trade_start,
        first_bar_ms=in_range[0].time if in_range else None,
        last_bar_ms=in_range[-1].time if in_range else None,
    )


def _to_bars(candles) -> list[Bar]:
    return [
        Bar(int(candles.ts[i]), float(candles.open[i]), float(candles.high[i]), float(candles.low[i]), float(candles.close[i]))
        for i in range(len(candles))
    ]


def _dedupe(bars: list[Bar]) -> list[Bar]:
    by_time: dict[int, Bar] = {}
    for bar in bars:
        by_time[bar.time] = bar
    return [by_time[key] for key in sorted(by_time)]
