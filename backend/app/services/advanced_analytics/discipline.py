"""Discipline and process: broken rules, plan compliance, execution, score dimensions, check-ins.

Check-ins: daily_checkins rows for the user where account_id is null or matches the
selected account. A trade belongs to the check-in of its local realized date; days
with trades but no check-in are reported as "none".
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Sequence

from app.services.advanced_analytics.core import (
    CLEAN,
    COMPLIANCE_BUCKETS,
    EXECUTION_BUCKETS,
    SCORE_DIMENSIONS,
    Context,
    TradeView,
    group_by,
    stats,
)
from app.services.advanced_analytics.psychology import label_comparisons

CHECKIN_ORDER = (("yes", "Followed plan"), ("partial", "Partially followed"), ("no", "Did not follow"), ("none", "No check-in"))


def _buckets(dimension: str, buckets, views, ctx) -> list[dict[str, Any]]:
    groups = group_by(dimension, views, ctx)
    return [{"key": key, "label": label, **stats(groups.get(key, []))} for key, label, _, _ in buckets]


def score_dimensions(views: Sequence[TradeView], previous: Sequence[TradeView] | None) -> list[dict[str, Any]]:
    rows = []
    for attr, label in SCORE_DIMENSIONS:
        cur = [int(v.scores[attr]) for v in views if v.scores.get(attr) is not None]
        prev = [int(v.scores[attr]) for v in (previous or []) if v.scores.get(attr) is not None]
        rows.append(
            {
                "key": attr,
                "label": label,
                "avg": round(sum(cur) / len(cur), 2) if cur else None,
                "rated_trades": len(cur),
                "previous_avg": round(sum(prev) / len(prev), 2) if prev else None,
                "previous_rated_trades": len(prev),
            }
        )
    return rows


def checkin_days(views: Sequence[TradeView], ctx: Context) -> list[dict[str, Any]]:
    days: dict[Any, float] = defaultdict(float)
    for v in views:
        days[v.realized_date] += v.pnl
    out = []
    for key, label in CHECKIN_ORDER:
        values = [p for d, p in days.items() if ctx.checkin.get(d, "none") == key]
        trades = [v for v in views if ctx.checkin.get(v.realized_date, "none") == key]
        out.append(
            {
                "key": key,
                "label": label,
                "days": len(values),
                "trades": len(trades),
                "avg_day_pnl": round(sum(values) / len(values), 2) if values else None,
                "net_pnl": round(sum(values), 2),
                "green_day_pct": round(sum(1 for p in values if p > 0) / len(values) * 100, 1) if values else None,
            }
        )
    return out


def process_by_month(views: Sequence[TradeView]) -> list[dict[str, Any]]:
    months: dict[str, list[TradeView]] = defaultdict(list)
    for v in views:
        months[v.local_realized.strftime("%Y-%m")].append(v)
    rows = []
    for key in sorted(months):
        group = months[key]
        healths = [v.health_score for v in group if v.health_score is not None]
        rows.append(
            {
                "key": key,
                "trades": len(group),
                "net_pnl": stats(group)["net_pnl"],
                "avg_execution": round(sum(v.execution_score for v in group) / len(group), 1),
                "avg_health": round(sum(healths) / len(healths), 1) if healths else None,
                "rule_break_pct": round(sum(1 for v in group if v.rules) / len(group) * 100, 1),
            }
        )
    return rows[-24:]


def build(views: Sequence[TradeView], ctx: Context, previous: Sequence[TradeView] | None) -> dict[str, Any]:
    clean = [v for v in views if not v.rules]
    broken = [v for v in views if v.rules]
    return {
        "rules": label_comparisons("rule", views, ctx, exclude=(CLEAN,)),
        "clean_vs_broken": {
            "clean": stats(clean),
            "broken": stats(broken),
            "clean_rate": round(len(clean) / len(views) * 100, 1) if views else None,
        },
        "compliance": _buckets("compliance", COMPLIANCE_BUCKETS, views, ctx),
        "compliance_rated": sum(1 for v in views if v.plan_compliance is not None),
        "execution": _buckets("execution", EXECUTION_BUCKETS, views, ctx),
        "score_dimensions": score_dimensions(views, previous),
        "checkins": checkin_days(views, ctx),
        "process_by_month": process_by_month(views),
        "execution_note": (
            "Execution score (0–100) comes from plan compliance, logged mistakes and emotions, "
            "recorded risk, screenshots, and your 1–10 trade ratings."
        ),
    }
