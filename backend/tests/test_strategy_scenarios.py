"""Hand-computed strategy scenarios (11 to 21). Python only; the TypeScript runner skips them."""

from __future__ import annotations

from app.services.backtest.engine import run_strategy
from app.services.backtest.rules import Bar, InstrumentSpec
from app.services.backtest.scenario_schema import load_scenarios
from app.services.backtest.strategy_schema import parse_strategy

INSTRUMENT = InstrumentSpec("BTCUSDT", "crypto", 0.01, 1, "USDT", 2)


def test_strategy_scenarios_match_the_hand_values():
    files = [item for item in load_scenarios() if item.mode == "strategy"]
    assert [item.id for item in files] == [f"{number:02d}" for number in range(11, 22)]
    for scenario in files:
        assert scenario.engines == ["python"]
        assert scenario.definition is not None and scenario.expected is not None and scenario.candles is not None
        definition = parse_strategy(scenario.definition)
        bars = [Bar(candle.time, candle.open, candle.high, candle.low, candle.close) for candle in scenario.candles]
        engine = run_strategy(definition, bars, INSTRUMENT)
        assert len(engine.trades) == len(scenario.expected.trades), scenario.id
        for got, want in zip(engine.trades, scenario.expected.trades, strict=True):
            assert got.id == want.id and got.side == want.side and got.exit_reason == want.exit_reason, scenario.id
            assert got.entry_price == want.entry_price, scenario.id
            assert got.exit_price == want.exit_price, scenario.id
            assert got.pips == want.pips, scenario.id
            assert got.pnl == want.pnl, scenario.id
            assert got.pnl_currency == want.pnl_currency, scenario.id
            if want.r_multiple is None:
                assert got.r_multiple is None
            else:
                assert abs(got.r_multiple - want.r_multiple) < 1e-9, scenario.id
        assert engine.skip_counts == scenario.expected.skip_counts, (scenario.id, engine.skip_counts)
