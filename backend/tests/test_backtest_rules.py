"""Shared trading rules against the hand-computed scenarios (backtesting 3A)."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.services.backtest.rules import Action, Bar, Costs, InstrumentSpec, OrderRequest, RuleEngine
from app.services.backtest.scenario_schema import ScenarioCase, ScenarioFile, load_scenarios

FILES = [item for item in load_scenarios() if item.mode == "orders"]


def _engine(case: ScenarioCase) -> RuleEngine:
    instrument = InstrumentSpec(
        case.instrument.symbol,
        case.instrument.asset_class,
        case.instrument.pip_size,
        case.instrument.contract_size,
        case.instrument.quote_currency,
        case.instrument.price_decimals,
    )
    costs = Costs(case.costs.spread_pips, case.costs.commission_per_lot, case.costs.slippage_pips)
    return RuleEngine(
        instrument,
        costs,
        account_currency=case.account_currency,
        initial_balance=case.initial_balance,
        conversion_rate=case.conversion_rate,
        close_at_end=case.close_at_end,
    )


def _actions(case: ScenarioCase) -> list[Action]:
    out = []
    for action in case.actions:
        order = None
        if action.order is not None:
            order = OrderRequest(
                action.order.id,
                action.order.side,
                action.order.kind,
                action.order.size,
                action.order.price,
                action.order.sl,
                action.order.tp,
            )
        out.append(Action(action.at, action.type, order, action.order_id))
    return out


def _check(file: ScenarioFile, case: ScenarioCase) -> None:
    bars = [Bar(c.time, c.open, c.high, c.low, c.close) for c in case.candles]
    result = _engine(case).run(bars, _actions(case))
    tol = file.tolerance
    assert len(result.fills) == len(case.expected.fills), case.name
    for got, want in zip(result.fills, case.expected.fills, strict=True):
        assert got.order_id == want.order_id and got.time == want.time and got.reason == want.reason
        assert got.price == pytest.approx(want.price, abs=tol.price)
        assert case.candles  # raw fill stays inside its bar
        bar = next(c for c in case.candles if c.time == got.time)
        assert bar.low - tol.price <= got.raw_price <= bar.high + tol.price
    assert len(result.trades) == len(case.expected.trades)
    for got, want in zip(result.trades, case.expected.trades, strict=True):
        assert got.id == want.id and got.side == want.side and got.exit_reason == want.exit_reason
        assert got.pnl_currency == want.pnl_currency
        assert got.entry_price == pytest.approx(want.entry_price, abs=tol.price)
        assert got.exit_price == pytest.approx(want.exit_price, abs=tol.price)
        assert got.pips == pytest.approx(want.pips, abs=tol.pips)
        assert got.pnl == pytest.approx(want.pnl, abs=tol.money)
        if want.r_multiple is None:
            assert got.r_multiple is None
        else:
            assert got.r_multiple == pytest.approx(want.r_multiple, abs=tol.r)
    assert result.warnings == case.expected.warnings
    if case.expected.stats is not None:
        stats = case.expected.stats
        assert len(result.trades) == stats.trade_count
        assert sum(1 for trade in result.trades if trade.pnl > 0) == stats.wins
        assert result.net_profit == pytest.approx(stats.net_profit, abs=tol.money)


@pytest.mark.parametrize("scenario", FILES, ids=[item.id for item in FILES])
def test_scenario_file_matches_rules(scenario: ScenarioFile):
    assert scenario.id
    for case in scenario.resolved_cases():
        _check(scenario, case)


def test_schema_rejects_unknown_fields():
    with pytest.raises(ValidationError):
        ScenarioFile.model_validate({"id": "x", "description": "x", "surprise": 1, "instrument": {
            "symbol": "EURUSD", "asset_class": "forex", "pip_size": 0.0001, "contract_size": 1, "quote_currency": "USD"
        }, "candles": [{"time": 0, "open": 1, "high": 1, "low": 1, "close": 1}], "expected": {"fills": [], "trades": []}})


def test_ten_scenarios_are_present():
    assert [item.id for item in FILES] == [f"{n:02d}" for n in range(1, 11)]
