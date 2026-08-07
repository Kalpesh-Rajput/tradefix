"""Prop firm distance-to-breach calculations."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from app.models.account import Account
from app.models.prop_settings import PropSettings
from app.models.trade import Trade


def distance_to_breach(account: Account, settings: PropSettings | None, trades: list[Trade]) -> dict:
    starting = float(account.initial_balance or 0)
    if starting <= 0:
        starting = 10000.0

    total_pnl = sum(float(t.pnl or 0) for t in trades)
    equity = starting + total_pnl
    overall_dd = max(0.0, starting - equity)
    overall_dd_pct = (overall_dd / starting) * 100 if starting else 0.0

    today = datetime.now(timezone.utc).date()
    day_pnl = sum(
        float(t.pnl or 0)
        for t in trades
        if t.closed_at and t.closed_at.astimezone(timezone.utc).date() == today
    )
    daily_loss = abs(min(0.0, day_pnl))
    daily_loss_pct = (daily_loss / starting) * 100 if starting else 0.0

    if not settings or not settings.enabled:
        return {
            "enabled": False,
            "equity": round(equity, 2),
            "starting_balance": starting,
            "daily_loss": round(daily_loss, 2),
            "daily_loss_pct": round(daily_loss_pct, 2),
            "daily_limit_pct": None,
            "daily_used_pct": 0,
            "overall_drawdown": round(overall_dd, 2),
            "overall_drawdown_pct": round(overall_dd_pct, 2),
            "overall_limit_pct": None,
            "overall_used_pct": 0,
            "daily_state": "ok",
            "overall_state": "ok",
            "profile": None,
        }

    daily_limit = float(settings.max_daily_loss_pct)
    overall_limit = float(settings.max_overall_drawdown_pct)
    warn = float(settings.warn_threshold_pct)
    danger = float(settings.danger_threshold_pct)

    daily_used = (daily_loss_pct / daily_limit * 100) if daily_limit else 0
    overall_used = (overall_dd_pct / overall_limit * 100) if overall_limit else 0

    def state(used: float) -> str:
        if used >= danger:
            return "danger"
        if used >= warn:
            return "warn"
        return "ok"

    return {
        "enabled": True,
        "equity": round(equity, 2),
        "starting_balance": starting,
        "daily_loss": round(daily_loss, 2),
        "daily_loss_pct": round(daily_loss_pct, 2),
        "daily_limit_pct": daily_limit,
        "daily_used_pct": round(min(100, daily_used), 1),
        "overall_drawdown": round(overall_dd, 2),
        "overall_drawdown_pct": round(overall_dd_pct, 2),
        "overall_limit_pct": overall_limit,
        "overall_used_pct": round(min(100, overall_used), 1),
        "daily_state": state(daily_used),
        "overall_state": state(overall_used),
        "profile": settings.profile,
        "warn_threshold_pct": warn,
        "danger_threshold_pct": danger,
    }
