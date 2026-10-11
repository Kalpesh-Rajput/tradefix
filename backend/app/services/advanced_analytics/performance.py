"""Performance: headline KPIs, realized equity + drawdown, monthly returns, daily distribution.

The equity series is *realized equity*: starting balance + cumulative closed-trade
P&L ordered by exit time. No deposits/withdrawals ledger exists, so it is never
labelled as account equity.
"""

from __future__ import annotations

import math
from collections import defaultdict
from typing import Any, Sequence

from app.services.advanced_analytics.core import (
    MONTH_SHORT,
    TradeView,
    downsample,
    r2,
    realized_order,
    sample_stdev,
    stats,
)
from app.services.tradefix_score import max_drawdown

EQUITY_POINTS = 400
TOP_EPISODES = 5
MIN_DAYS_FOR_DISTRIBUTION = 5
MIN_TRADES_FOR_COMPARISON = 5


def kpis(views: Sequence[TradeView], starting_balance: float) -> dict[str, Any]:
    base = stats(views)
    dd = max_drawdown(views, starting_equity=starting_balance)
    r_values = [v.r for v in views if v.r is not None]
    days: dict[Any, float] = defaultdict(float)
    for v in views:
        days[v.realized_date] += v.pnl
    net = base["net_pnl"]
    dd_amount = float(dd["amount"])
    return {
        **base,
        "expectancy": base["avg_pnl"],
        "max_drawdown": round(dd_amount, 2),
        "max_drawdown_pct": round(float(dd["pct"]), 2),
        "recovery_factor": round(net / dd_amount, 2) if dd_amount > 0 else None,
        "largest_win": r2(max((v.pnl for v in views if v.pnl > 0), default=None)),
        "largest_loss": r2(min((v.pnl for v in views if v.pnl < 0), default=None)),
        "total_fees": round(sum(v.fees for v in views), 2),
        "trading_days": len(days),
        "green_days": sum(1 for p in days.values() if p > 0),
        "red_days": sum(1 for p in days.values() if p < 0),
        "best_day": r2(max(days.values())) if days else None,
        "worst_day": r2(min(days.values())) if days else None,
        "avg_r": round(sum(r_values) / len(r_values), 3) if r_values else None,
        "r_coverage": round(len(r_values) / len(views) * 100, 1) if views else None,
        "avg_execution": round(sum(v.execution_score for v in views) / len(views), 1) if views else None,
    }


def comparison(current: dict[str, Any], previous: dict[str, Any] | None) -> dict[str, Any] | None:
    if previous is None or previous["trades"] < MIN_TRADES_FOR_COMPARISON or current["trades"] < MIN_TRADES_FOR_COMPARISON:
        return None
    keys = ("net_pnl", "win_rate", "profit_factor", "expectancy", "max_drawdown", "max_drawdown_pct", "trades", "payoff")
    out = {}
    for key in keys:
        a, b = current.get(key), previous.get(key)
        out[key] = {"previous": b, "delta": round(a - b, 2) if a is not None and b is not None else None}
    return out


def equity(views: Sequence[TradeView], starting_balance: float) -> dict[str, Any]:
    ordered = realized_order(views)
    points: list[dict[str, Any]] = []
    running = 0.0
    peak_equity = starting_balance
    trough_idx = 0
    worst = 0.0
    for i, v in enumerate(ordered):
        running += v.pnl
        value = starting_balance + running
        peak_equity = max(peak_equity, value)
        dd = value - peak_equity
        dd_pct = (dd / peak_equity * 100) if peak_equity > 0 else None
        if dd < worst:
            worst, trough_idx = dd, i
        points.append(
            {
                "index": i + 1,
                "date": v.realized_date.isoformat(),
                "trade_id": v.id,
                "pnl": round(v.pnl, 2),
                "cumulative_pnl": round(running, 2),
                "equity": round(value, 2),
                "drawdown": round(dd, 2),
                "drawdown_pct": round(dd_pct, 2) if dd_pct is not None else None,
            }
        )
    return {
        "starting_balance": round(starting_balance, 2),
        "basis": "realized",
        "points": downsample(points, EQUITY_POINTS, keep=[trough_idx]),
        "total_points": len(points),
        "episodes": episodes(ordered, starting_balance),
    }


def episodes(ordered: Sequence[TradeView], starting_balance: float) -> list[dict[str, Any]]:
    """Peak -> trough -> recovery (first return to >= peak). Unrecovered episodes are 'open'."""
    path = [starting_balance]
    for v in ordered:
        path.append(path[-1] + v.pnl)
    dates = [None] + [v.realized_date for v in ordered]
    found: list[dict[str, Any]] = []
    peak_i = 0
    i = 1
    while i < len(path):
        if path[i] >= path[peak_i]:
            peak_i = i
            i += 1
            continue
        trough_i = i
        j = i
        while j < len(path) and path[j] < path[peak_i]:
            if path[j] < path[trough_i]:
                trough_i = j
            j += 1
        recovered = j < len(path)
        depth = path[peak_i] - path[trough_i]
        start_date = dates[peak_i] or dates[1]
        end_date = dates[j] if recovered else None
        found.append(
            {
                "start_date": start_date.isoformat() if start_date else None,
                "trough_date": dates[trough_i].isoformat() if dates[trough_i] else None,
                "recovery_date": end_date.isoformat() if end_date else None,
                "depth": round(depth, 2),
                "depth_pct": round(depth / path[peak_i] * 100, 2) if path[peak_i] > 0 else None,
                "trades_to_trough": trough_i - peak_i,
                "trades_to_recover": (j - trough_i) if recovered else None,
                "days": ((end_date or dates[-1]) - start_date).days if start_date and (end_date or dates[-1]) else None,
                "recovered": recovered,
            }
        )
        peak_i = j
        i = j + 1 if recovered else len(path)
    found.sort(key=lambda e: e["depth"], reverse=True)
    return found[:TOP_EPISODES]


def monthly(views: Sequence[TradeView], starting_balance: float) -> list[dict[str, Any]]:
    ordered = realized_order(views)
    buckets: dict[tuple[int, int], list[TradeView]] = defaultdict(list)
    for v in ordered:
        buckets[(v.local_realized.year, v.local_realized.month)].append(v)
    rows = []
    equity_before = starting_balance
    for (year, month) in sorted(buckets):
        group = buckets[(year, month)]
        s = stats(group)
        rows.append(
            {
                "year": year,
                "month": month,
                "key": f"{year}-{month:02d}",
                "label": f"{MONTH_SHORT[month - 1]} {year}",
                "trades": s["trades"],
                "net_pnl": s["net_pnl"],
                "win_rate": s["win_rate"],
                "return_pct": round(s["net_pnl"] / equity_before * 100, 2) if equity_before > 0 else None,
                "equity_start": round(equity_before, 2),
            }
        )
        equity_before += s["net_pnl"]
    return rows


def daily_distribution(views: Sequence[TradeView]) -> dict[str, Any]:
    days: dict[Any, float] = defaultdict(float)
    for v in views:
        days[v.realized_date] += v.pnl
    values = [round(p, 2) for p in days.values()]
    if len(values) < MIN_DAYS_FOR_DISTRIBUTION:
        return {
            "status": "insufficient",
            "reason": f"Needs at least {MIN_DAYS_FOR_DISTRIBUTION} trading days; this range has {len(values)}.",
            "sample_size": len(values),
            "bins": [],
        }
    lo, hi = min(values), max(values)
    count = max(5, min(20, math.ceil(math.sqrt(len(values)))))
    if hi == lo:
        hi = lo + 1
    width = (hi - lo) / count
    bins = []
    for i in range(count):
        start = lo + i * width
        end = start + width
        bins.append({"start": round(start, 2), "end": round(end, 2), "days": 0, "green": 0, "red": 0})
    for value in values:
        idx = min(count - 1, int((value - lo) / width))
        bins[idx]["days"] += 1
        if value > 0:
            bins[idx]["green"] += 1
        elif value < 0:
            bins[idx]["red"] += 1
    greens = [p for p in values if p > 0]
    reds = [p for p in values if p < 0]
    ordered = sorted(values)
    mid = len(ordered) // 2
    median = ordered[mid] if len(ordered) % 2 else (ordered[mid - 1] + ordered[mid]) / 2
    return {
        "status": "ok",
        "reason": None,
        "sample_size": len(values),
        "bins": bins,
        "mean": round(sum(values) / len(values), 2),
        "median": round(median, 2),
        "stdev": r2(sample_stdev(values)),
        "green_days": len(greens),
        "red_days": len(reds),
        "flat_days": len(values) - len(greens) - len(reds),
        "avg_green": r2(sum(greens) / len(greens)) if greens else None,
        "avg_red": r2(sum(reds) / len(reds)) if reds else None,
    }
