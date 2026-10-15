"""Strategy engine behaviour, look-ahead, and a timed 100k-bar run (backtesting 4C)."""

import time
from datetime import datetime, timezone

import numpy as np

from app.services.backtest.engine import run_strategy
from app.services.backtest.indicators import ema, rsi, sma
from app.services.backtest.rules import Bar, InstrumentSpec
from app.services.backtest.strategy_schema import parse_strategy

INSTRUMENT = InstrumentSpec("BTCUSDT", "crypto", 0.01, 1, "USDT", 2)


def _bars(closes: list[float], start: datetime) -> list[Bar]:
    out = []
    for index, close in enumerate(closes):
        moment = int((start.timestamp() + index * 3600) * 1000)
        out.append(Bar(moment, close, close + 1, close - 1, close))
    return out


def _definition(**overrides):
    body = {
        "schema_version": 1,
        "name": "close above",
        "market": {"symbol": "BTCUSDT", "timeframe": "1h", "start_ms": 0, "end_ms": 86_400_000},
        "direction": "long",
        "long_entry": {
            "combine": "all",
            "conditions": [
                {"left": {"kind": "price", "field": "close"}, "operator": "gt", "right": {"kind": "constant", "value": 10}}
            ],
        },
        "stop_loss": {"type": "pips", "value": 100000},
        "take_profit": {"type": "pips", "value": 100000},
        "risk": {"initial_balance": 10000, "fixed_size": 1},
        "costs": {"spread_pips": 0, "commission_per_lot": 0, "slippage_pips": 0},
    }
    body.update(overrides)
    return parse_strategy(body)


def test_one_position_ignores_a_second_signal():
    start = datetime(2026, 1, 5, tzinfo=timezone.utc)  # Monday
    engine = run_strategy(_definition(), _bars([9, 12, 13, 14, 15], start), INSTRUMENT)
    assert len(engine.trades) + (1 if engine.position else 0) == 1


def test_reverse_on_opposite_signal():
    start = datetime(2026, 1, 5, tzinfo=timezone.utc)
    definition = _definition(
        direction="both",
        exit_on_opposite=True,
        short_entry={
            "combine": "all",
            "conditions": [
                {"left": {"kind": "price", "field": "close"}, "operator": "lt", "right": {"kind": "constant", "value": 10}}
            ],
        },
    )
    engine = run_strategy(definition, _bars([12, 13, 8, 7], start), INSTRUMENT)
    sides = [trade.side for trade in engine.trades]
    assert "buy" in sides or (engine.position and engine.position.side == "sell")


def test_weekday_filter_blocks_sunday():
    sunday = datetime(2026, 1, 4, tzinfo=timezone.utc)
    definition = _definition(filters={"weekdays": [0]})
    engine = run_strategy(definition, _bars([12, 13, 14, 15], sunday), INSTRUMENT)
    assert engine.trades == [] and engine.position is None


def test_warmup_blocks_early_signals():
    start = datetime(2026, 1, 5, tzinfo=timezone.utc)
    definition = _definition(
        long_entry={
            "combine": "all",
            "conditions": [
                {
                    "left": {"kind": "indicator", "name": "sma", "period": 5},
                    "operator": "gt",
                    "right": {"kind": "constant", "value": 0},
                }
            ],
        }
    )
    engine = run_strategy(definition, _bars([12, 12, 12, 12], start), INSTRUMENT)
    assert engine.position is None and engine.trades == []


def test_indicators_do_not_look_ahead():
    base = np.arange(1.0, 50.0)
    changed = base.copy()
    changed[30:] = np.random.default_rng(7).random(len(changed) - 30) * 100
    for fn in (sma, ema, rsi):
        left = fn(base, 5)
        right = fn(changed, 5)
        assert np.allclose(left[:30], right[:30], equal_nan=True)


def test_hundred_thousand_bars_finish_quickly():
    start = datetime(2020, 1, 6, tzinfo=timezone.utc)
    closes = [10 + (index % 7) for index in range(100_000)]
    began = time.perf_counter()
    run_strategy(_definition(), _bars(closes, start), INSTRUMENT)
    elapsed = time.perf_counter() - began
    print(f"100k bar run: {elapsed:.2f}s")
    assert elapsed < 10
