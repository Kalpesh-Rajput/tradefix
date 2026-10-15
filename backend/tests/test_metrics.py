"""Hand-checked metrics and peak-preserving downsampling (backtesting 4C)."""

from app.services.backtest.downsample import downsample_minmax
from app.services.backtest.metrics import summarize_trades, warnings_for


def test_metrics_match_a_two_trade_list():
    trades = [
        {"pnl": 100.0, "r": 1.0, "bars_held": 4},
        {"pnl": -40.0, "r": -0.5, "bars_held": 2},
    ]
    equity = [(0, 1000.0), (10, 1100.0), (20, 1060.0)]
    stats = summarize_trades(trades, initial=1000, equity=equity)
    assert stats["net_profit"] == 60
    assert stats["return_pct"] == 6
    assert stats["win_rate"] == 0.5
    assert stats["profit_factor"] == 2.5
    assert stats["expectancy_r"] == 0.25
    assert stats["average_win"] == 100
    assert stats["average_loss"] == -40
    assert stats["payoff_ratio"] == 2.5
    assert stats["max_drawdown"] == 40
    assert stats["longest_win_streak"] == 1
    assert stats["best_trade"] == 100
    assert stats["worst_trade"] == -40


def test_no_losses_leaves_profit_factor_open():
    stats = summarize_trades([{"pnl": 10.0, "r": 1.0}], initial=100, equity=[(0, 100.0), (1, 110.0)])
    assert stats["profit_factor"] is None


def test_downsample_keeps_the_extreme():
    points = [(index, value) for index, value in enumerate([1, 5, 0, 4, 2, 9, 3])]
    kept = downsample_minmax(points, 4)
    values = [value for _time, value in kept]
    assert 0 in values and 9 in values
    assert kept[0] == points[0]
    assert kept[-1] == points[-1]


def test_warnings_cover_the_small_sample():
    notes = warnings_for([{"pnl": 1.0}], spread_pips=0, slippage_pips=0, range_ms=86_400_000)
    assert "fewer than 30 trades" in notes
    assert "spread and slippage set to zero" in notes
    assert "past performance does not predict future results" in notes
