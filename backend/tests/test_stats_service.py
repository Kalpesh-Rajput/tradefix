from datetime import datetime, timezone
from types import SimpleNamespace

from app.services.stats_service import expectancy, overview_from_trades, profit_factor, win_rate

OPENED = datetime(2026, 3, 1, 14, 30, tzinfo=timezone.utc)


def _trade(pnl: float, fees: float = 0.0) -> SimpleNamespace:
    return SimpleNamespace(
        pnl=pnl,
        fees=fees,
        symbol="TEST",
        opened_at=OPENED,
        closed_at=OPENED,
        plan_compliance=None,
        rules_broken=[],
        emotion_tags=[],
        screenshot_urls=[],
        risk_amount=None,
        score_preparation=None,
        score_risk=None,
        score_entry=None,
        score_exit=None,
        score_discipline=None,
        score_psychology=None,
    )


def test_win_rate_and_counts():
    trades = [_trade(100), _trade(-40), _trade(0), _trade(20)]
    overview = overview_from_trades(trades)
    assert overview["win_count"] == 2
    assert overview["loss_count"] == 1
    assert overview["breakeven_count"] == 1
    assert overview["win_rate"] == 50.0
    assert overview["total_trades"] == 4
    assert overview["total_pnl"] == 80.0


def test_profit_factor_zero_when_only_losses():
    trades = [_trade(-100), _trade(-50)]
    assert profit_factor(trades) == 0.0
    overview = overview_from_trades(trades)
    assert overview["profit_factor"] == 0.0
    assert overview["win_count"] == 0
    assert overview["loss_count"] == 2


def test_expectancy_is_average_pnl():
    trades = [_trade(100), _trade(-40)]
    assert expectancy(trades) == 30.0
    assert overview_from_trades(trades)["expectancy"] == 30.0


def test_empty_overview_counts():
    overview = overview_from_trades([])
    assert overview["total_trades"] == 0
    assert overview["win_rate"] == 0.0
    assert overview["profit_factor"] == 0.0
    assert overview["win_count"] == 0
    assert overview["loss_count"] == 0
    assert overview["breakeven_count"] == 0
    assert win_rate([]) == 0.0
