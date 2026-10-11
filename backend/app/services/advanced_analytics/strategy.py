"""Strategy, setup, side, and symbol attribution.

Setup tags are multi-label: one trade can count toward several setups, so setup
totals overlap and must not be summed. Strategy (strategy_name) is single-valued.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any, Sequence

from app.services.advanced_analytics.core import (
    NO_STRATEGY,
    Context,
    TradeView,
    downsample,
    group_by,
    mean,
    realized_order,
    stats,
)

SPARK_POINTS = 24
TOP_SYMBOLS = 15
MAX_ROWS = 50


def _spark(group: Sequence[TradeView]) -> list[float]:
    running = 0.0
    out = []
    for v in realized_order(group):
        running += v.pnl
        out.append(round(running, 2))
    return downsample(out, SPARK_POINTS)


def _wr(group: Sequence[TradeView]) -> float | None:
    return stats(group)["win_rate"] if group else None


def _row(key: str, label: str, group: Sequence[TradeView], latest) -> dict[str, Any]:
    s = stats(group)
    r_values = [v.r for v in group if v.r is not None]
    last30 = [v for v in group if v.realized_date > latest - timedelta(days=30)]
    prior30 = [v for v in group if latest - timedelta(days=60) < v.realized_date <= latest - timedelta(days=30)]
    return {
        "key": key,
        "label": label,
        **s,
        "avg_r": round(mean(r_values) or 0.0, 3) if r_values else None,
        "r_trades": len(r_values),
        "win_rate_last_30d": _wr(last30),
        "win_rate_prior_30d": _wr(prior30),
        "trades_last_30d": len(last30),
        "spark": _spark(group),
    }


def _leaderboard(dimension: str, views: Sequence[TradeView], ctx: Context, label_fn) -> list[dict[str, Any]]:
    if not views:
        return []
    latest = max(v.realized_date for v in views)
    rows = [_row(key, label_fn(key), group, latest) for key, group in group_by(dimension, views, ctx).items()]
    rows.sort(key=lambda r: (r["net_pnl"], r["trades"]), reverse=True)
    return rows[:MAX_ROWS]


def build(views: Sequence[TradeView], ctx: Context) -> dict[str, Any]:
    strategies = _leaderboard("strategy", views, ctx, lambda k: "No strategy" if k == NO_STRATEGY else k)
    setups = _leaderboard("setup", views, ctx, lambda k: k)
    tagged = [v for v in views if v.setups]
    multi = sum(1 for v in tagged if len(v.setups) > 1)

    sides = []
    for key, group in sorted(group_by("side", views, ctx).items()):
        sides.append({"key": key, "label": key.title(), **stats(group)})

    asset_types = []
    for key, group in group_by("asset_type", views, ctx).items():
        asset_types.append({"key": key, "label": key.title(), **stats(group)})
    asset_types.sort(key=lambda r: r["trades"], reverse=True)

    symbol_rows = []
    for key, group in group_by("symbol", views, ctx).items():
        s = stats(group)
        symbol_rows.append({"key": key, "label": key, **s})
    symbol_rows.sort(key=lambda r: r["net_pnl"], reverse=True)
    total_positive = sum(r["net_pnl"] for r in symbol_rows if r["net_pnl"] > 0)
    running = 0.0
    for row in symbol_rows:
        if row["net_pnl"] > 0 and total_positive > 0:
            running += row["net_pnl"]
            row["share_of_profit_pct"] = round(row["net_pnl"] / total_positive * 100, 1)
            row["cumulative_share_pct"] = round(running / total_positive * 100, 1)
        else:
            row["share_of_profit_pct"] = None
            row["cumulative_share_pct"] = None

    by_impact = sorted(symbol_rows, key=lambda r: abs(r["net_pnl"]), reverse=True)
    top_keys = {r["key"] for r in by_impact[:TOP_SYMBOLS]}
    top = [r for r in symbol_rows if r["key"] in top_keys]
    rest = [r for r in symbol_rows if r["key"] not in top_keys]
    other = None
    if rest:
        other = {
            "symbols": len(rest),
            "trades": sum(r["trades"] for r in rest),
            "net_pnl": round(sum(r["net_pnl"] for r in rest), 2),
        }
    return {
        "strategies": strategies,
        "setups": setups,
        "setup_overlap": {
            "tagged_trades": len(tagged),
            "multi_tagged_trades": multi,
            "note": "A trade with several setup tags counts toward each tag, so setup totals overlap.",
        },
        "sides": sides,
        "asset_types": asset_types,
        "symbols": top,
        "symbols_other": other,
        "symbol_count": len(symbol_rows),
        "profitable_symbols": sum(1 for r in symbol_rows if r["net_pnl"] > 0),
    }
