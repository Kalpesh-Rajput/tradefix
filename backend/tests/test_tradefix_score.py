from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.services.stats_service import overview_from_trades, profit_factor
from app.services.tradefix_score import (
    WEIGHTS,
    average_win_loss_ratio,
    calculate_tradefix_score,
    clamp_score,
    consistency_breakdown,
    max_drawdown,
    piecewise,
    profit_factor_ratio,
    realized_totals,
    recovery_factor_value,
    sample_confidence,
    score_drawdown,
    score_ratio,
    score_win_rate,
    win_rate_pct,
)


def _trade(pnl: float, day: int = 1, fees: float = 0.0) -> SimpleNamespace:
    opened = datetime(2026, 3, day, 14, 30, tzinfo=timezone.utc)
    return SimpleNamespace(
        pnl=pnl,
        fees=fees,
        symbol="TEST",
        opened_at=opened,
        closed_at=opened + timedelta(hours=1),
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


MANUAL = [
    _trade(100, 1),
    _trade(200, 2),
    _trade(-100, 3),
    _trade(150, 4),
    _trade(-50, 5),
]


def test_manual_dataset_core_metrics():
    totals = realized_totals(MANUAL)
    assert totals["gross_profit"] == 450
    assert totals["gross_loss"] == 150
    assert totals["win_count"] == 3
    assert totals["loss_count"] == 2
    assert totals["net_pnl"] == 300
    assert win_rate_pct(totals) == pytest.approx(60.0)
    assert profit_factor_ratio(totals) == pytest.approx(3.0)
    assert totals["avg_win"] == pytest.approx(150)
    assert totals["avg_loss"] == pytest.approx(75)
    assert average_win_loss_ratio(totals) == pytest.approx(2.0)


def test_manual_dataset_drawdown_and_recovery():
    # Equity from 0: 100, 300, 200, 350, 300 → max DD 100 after trade 3.
    dd = max_drawdown(MANUAL, starting_equity=0)
    assert dd["amount"] == pytest.approx(100)
    rf = recovery_factor_value(300, dd["amount"])
    assert rf == pytest.approx(3.0)


def test_weighted_final_score_bounds():
    result = calculate_tradefix_score(MANUAL, starting_equity=0)
    assert result["overall_score"] is not None
    assert 0 <= result["overall_score"] <= 100
    contrib = sum(m["contribution"] for m in result["metrics"].values())
    assert sum(WEIGHTS.values()) == pytest.approx(1.0)
    assert contrib == pytest.approx(result["overall_score_raw"])
    for metric in result["metrics"].values():
        assert 0 <= metric["score"] <= 100


def test_win_rate_normalization_not_raw():
    assert score_win_rate(70) == pytest.approx(90)
    assert score_win_rate(70) < 100
    assert score_win_rate(50) == pytest.approx(55)
    assert score_win_rate(30) == pytest.approx(25)


def test_profit_factor_all_wins_not_infinity():
    trades = [_trade(100), _trade(50)]
    totals = realized_totals(trades)
    assert profit_factor_ratio(totals) is None
    result = calculate_tradefix_score(trades)
    pf = result["metrics"]["profit_factor"]
    assert pf["actual"] is None
    assert pf["score"] <= 100
    assert pf["undefined_reason"]


def test_all_losers():
    trades = [_trade(-100), _trade(-40)]
    result = calculate_tradefix_score(trades)
    assert result["metrics"]["win_rate"]["actual"] == 0
    assert result["metrics"]["profit_factor"]["actual"] == 0
    assert result["overall_score"] < 40


def test_high_win_rate_huge_losses_not_dominant():
    trades = [_trade(10)] * 9 + [_trade(-500)]
    result = calculate_tradefix_score(trades)
    wr = result["metrics"]["win_rate"]
    pf = result["metrics"]["profit_factor"]
    assert wr["actual"] == pytest.approx(90)
    assert pf["actual"] == pytest.approx(90 / 500)
    assert pf["score"] < wr["score"]
    assert result["overall_score"] < wr["score"]


def test_low_win_rate_huge_winners():
    trades = [_trade(-10)] * 9 + [_trade(500)]
    result = calculate_tradefix_score(trades)
    assert result["metrics"]["win_rate"]["actual"] == pytest.approx(10)
    assert result["metrics"]["profit_factor"]["actual"] == pytest.approx(500 / 90)
    assert result["metrics"]["profit_factor"]["score"] > result["metrics"]["win_rate"]["score"]


def test_zero_pnl_and_missing():
    trades = [_trade(0), _trade(0)]
    result = calculate_tradefix_score(trades)
    assert result["overall_score"] is not None
    assert result["metrics"]["profit_factor"]["actual"] == 0.0
    empty = calculate_tradefix_score([])
    assert empty["overall_score"] is None
    assert empty["confidence"]["level"] == "none"


def test_one_huge_winner_concentration_penalizes_consistency():
    trades = [_trade(1000, 1), _trade(10, 2), _trade(10, 3), _trade(-20, 4)]
    totals = realized_totals(trades)
    cons = consistency_breakdown(trades, totals)
    assert cons["profit_concentration"] > 0.9
    even = [_trade(100, d) for d in range(1, 6)] + [_trade(-40, 6)]
    even_cons = consistency_breakdown(even, realized_totals(even))
    assert cons["score"] < even_cons["score"]


def test_no_drawdown_recovery_capped():
    trades = [_trade(50, 1), _trade(50, 2), _trade(50, 3)]
    dd = max_drawdown(trades, starting_equity=0)
    assert dd["amount"] == 0
    result = calculate_tradefix_score(trades)
    assert result["metrics"]["recovery_factor"]["actual"] is None
    assert result["metrics"]["recovery_factor"]["score"] <= 92
    assert result["metrics"]["recovery_factor"]["score"] > 0


def test_negative_net_profit():
    trades = [_trade(20), _trade(-100)]
    result = calculate_tradefix_score(trades)
    assert result["metrics"]["recovery_factor"]["actual"] < 0
    assert result["overall_score"] < 50


def test_confidence_thresholds():
    assert sample_confidence(0)["level"] == "none"
    assert sample_confidence(3)["level"] == "insufficient"
    assert sample_confidence(8)["level"] == "low"
    assert sample_confidence(25)["level"] == "moderate"
    assert sample_confidence(84)["level"] == "high"


def test_drawdown_uses_equity_not_worst_trade():
    trades = [_trade(-30, 1), _trade(-40, 2), _trade(10, 3)]
    dd = max_drawdown(trades, starting_equity=0)
    # Worst trade is -40, but cumulative trough is -70.
    assert dd["amount"] == pytest.approx(70)


def test_starting_equity_changes_drawdown_pct_not_amount():
    dd0 = max_drawdown(MANUAL, starting_equity=0)
    dd1 = max_drawdown(MANUAL, starting_equity=10_000)
    assert dd0["amount"] == pytest.approx(dd1["amount"])
    assert dd1["pct"] < dd0["pct"]


def test_overview_includes_score_and_fixed_profit_factor():
    overview = overview_from_trades(MANUAL)
    assert overview["profit_factor"] == pytest.approx(3.0)
    assert overview["tradefix_score"]["overall_score"] is not None
    assert overview["avg_win_loss_ratio"] == pytest.approx(2.0)
    assert overview["recovery_factor"] == pytest.approx(3.0)
    all_wins = overview_from_trades([_trade(100), _trade(50)])
    assert all_wins["profit_factor"] == 0.0
    assert profit_factor([_trade(100), _trade(50)]) == 0.0


def test_piecewise_and_clamp_never_nan():
    assert clamp_score(float("inf")) == 0.0
    assert clamp_score(float("nan")) == 0.0
    assert 0 <= piecewise(999, ((0, 0), (1, 100))) <= 100
    assert score_ratio(None, all_wins=True) == 92
    assert score_drawdown(0) == 100
    assert score_drawdown(60) == 0


def test_consistency_not_equal_to_win_rate():
    # Same 6/7 win rate; one book depends on a single oversized winner.
    concentrated = [_trade(500, 1)] + [_trade(10, d) for d in range(2, 7)] + [_trade(-40, 7)]
    even = [_trade(90, d) for d in range(1, 7)] + [_trade(-40, 7)]
    c1 = calculate_tradefix_score(concentrated)
    c2 = calculate_tradefix_score(even)
    assert c1["metrics"]["win_rate"]["actual"] == c2["metrics"]["win_rate"]["actual"]
    assert c1["metrics"]["consistency"]["score"] < c2["metrics"]["consistency"]["score"]
