"""Backtest metrics from a closed-trade list and an equity series (backtesting/03 section 9)."""

from __future__ import annotations

import math


def _mean(values: list[float]) -> float | None:
    return sum(values) / len(values) if values else None


def summarize_trades(trades: list[dict], *, initial: float, equity: list[tuple[int, float]]) -> dict:
    pnls = [float(trade["pnl"]) for trade in trades]
    wins = [value for value in pnls if value > 0]
    losses = [value for value in pnls if value < 0]
    rs = [float(trade["r"]) for trade in trades if trade.get("r") is not None]
    gross_profit = sum(wins)
    gross_loss = abs(sum(losses))
    net = sum(pnls)
    streaks = _streaks(pnls)
    drawdown = _drawdown(equity)
    daily = _daily_returns(equity)
    sharpe = None
    if len(daily) > 1:
        avg = sum(daily) / len(daily)
        var = sum((value - avg) ** 2 for value in daily) / (len(daily) - 1)
        if var > 0:
            sharpe = (avg / math.sqrt(var)) * math.sqrt(252)
    return {
        "net_profit": net,
        "return_pct": (net / initial * 100) if initial else 0,
        "trade_count": len(trades),
        "win_rate": (len(wins) / len(trades)) if trades else 0,
        "average_win": _mean(wins),
        "average_loss": _mean(losses),
        "payoff_ratio": ( _mean(wins) / abs(_mean(losses)) ) if wins and losses and _mean(losses) else None,
        "profit_factor": None if gross_loss == 0 and gross_profit > 0 else (gross_profit / gross_loss if gross_loss else 0),
        "expectancy_r": _mean(rs),
        "average_r": _mean(rs),
        "max_drawdown": drawdown["amount"],
        "max_drawdown_pct": drawdown["pct"],
        "max_drawdown_start_ms": drawdown["start_ms"],
        "max_drawdown_end_ms": drawdown["end_ms"],
        "longest_win_streak": streaks[0],
        "longest_loss_streak": streaks[1],
        "average_bars_held": _mean([float(trade.get("bars_held") or 0) for trade in trades]),
        "best_trade": max(pnls) if pnls else None,
        "worst_trade": min(pnls) if pnls else None,
        "sharpe_indicative": sharpe,
    }


def warnings_for(trades: list[dict], *, spread_pips: float, slippage_pips: float, range_ms: int) -> list[str]:
    notes = ["past performance does not predict future results"]
    if len(trades) < 30:
        notes.append("fewer than 30 trades")
    wins = sum(1 for trade in trades if trade["pnl"] > 0)
    if trades and wins / len(trades) > 0.8 and len(trades) < 30:
        notes.append("very high win rate with very few trades")
    if spread_pips == 0 and slippage_pips == 0:
        notes.append("spread and slippage set to zero")
    if range_ms < 90 * 24 * 60 * 60 * 1000:
        notes.append("range shorter than 3 months")
    return notes


def _streaks(pnls: list[float]) -> tuple[int, int]:
    best_win = best_loss = win = loss = 0
    for value in pnls:
        if value > 0:
            win += 1
            loss = 0
        elif value < 0:
            loss += 1
            win = 0
        else:
            win = loss = 0
        best_win = max(best_win, win)
        best_loss = max(best_loss, loss)
    return best_win, best_loss


def _drawdown(equity: list[tuple[int, float]]) -> dict:
    peak = None
    peak_ms = None
    worst = 0.0
    start_ms = end_ms = None
    for time_ms, value in equity:
        if peak is None or value > peak:
            peak, peak_ms = value, time_ms
        drop = peak - value if peak is not None else 0
        if drop > worst:
            worst = drop
            start_ms, end_ms = peak_ms, time_ms
    pct = (worst / peak * 100) if peak else 0
    return {"amount": worst, "pct": pct, "start_ms": start_ms, "end_ms": end_ms}


def _daily_returns(equity: list[tuple[int, float]]) -> list[float]:
    by_day: dict[int, float] = {}
    for time_ms, value in equity:
        by_day[time_ms // 86_400_000] = value
    days = [by_day[key] for key in sorted(by_day)]
    return [(days[i] - days[i - 1]) / days[i - 1] for i in range(1, len(days)) if days[i - 1]]
