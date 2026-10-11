"""Timing edge: weekday x hour (local entry time), sessions, and hold time."""

from __future__ import annotations

from typing import Any, Sequence

from app.services.advanced_analytics.core import (
    HOLD_BUCKETS,
    WEEKDAY_SHORT,
    Context,
    TradeView,
    downsample,
    group_by,
    stats,
)

SESSION_ORDER = ("Asia", "London", "Overlap", "NY", "Off")
MAX_SCATTER = 600


def _cell(key: str, group: Sequence[TradeView]) -> dict[str, Any]:
    s = stats(group)
    return {"key": key, "trades": s["trades"], "win_rate": s["win_rate"], "net_pnl": s["net_pnl"], "avg_pnl": s["avg_pnl"]}


def build(views: Sequence[TradeView], ctx: Context) -> dict[str, Any]:
    cells_by = group_by("weekday_hour", views, ctx)
    cells = []
    for key, group in cells_by.items():
        weekday, hour = (int(x) for x in key.split("-"))
        cells.append({**_cell(key, group), "weekday": weekday, "hour": hour})
    cells.sort(key=lambda c: (c["weekday"], c["hour"]))

    weekdays_by = group_by("weekday", views, ctx)
    weekdays = [
        {**_cell(str(i), weekdays_by.get(str(i), [])), "label": WEEKDAY_SHORT[i], "weekday": i} for i in range(7)
    ]
    hours_by = group_by("hour", views, ctx)
    hours = [{**_cell(str(h), hours_by.get(str(h), [])), "hour": h, "label": f"{h:02d}:00"} for h in range(24)]

    sessions_by = group_by("session", views, ctx)
    names = list(SESSION_ORDER) + sorted(k for k in sessions_by if k not in SESSION_ORDER)
    sessions = [{**_cell(name, sessions_by.get(name, [])), "label": name} for name in names if sessions_by.get(name)]

    hold_by = group_by("hold", views, ctx)
    holds = [{**_cell(key, hold_by.get(key, [])), "label": label} for key, label, _ in HOLD_BUCKETS]
    with_hold = [v for v in views if v.hold_seconds is not None]
    scatter = sorted(
        ({"id": v.id, "seconds": int(v.hold_seconds or 0), "pnl": round(v.pnl, 2), "symbol": v.symbol} for v in with_hold),
        key=lambda p: (p["seconds"], p["pnl"]),
    )
    return {
        "timezone_basis": "Local entry time in your profile timezone.",
        "weekday_hour": cells,
        "weekdays": weekdays,
        "hours": hours,
        "sessions": sessions,
        "hold_buckets": holds,
        "hold_scatter": downsample(scatter, MAX_SCATTER),
        "hold_scatter_total": len(scatter),
        "missing_hold": len(views) - len(with_hold),
    }
