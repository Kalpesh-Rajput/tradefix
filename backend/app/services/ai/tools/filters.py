from __future__ import annotations

from datetime import datetime, timezone

from app.models.trade import TradeSide
from app.services.stats_service import _session_for_hour

SESSION_ALIASES = {
    "ny": "NY",
    "nyc": "NY",
    "new york": "NY",
    "newyork": "NY",
    "us": "NY",
    "london": "London",
    "uk": "London",
    "asia": "Asia",
    "asian": "Asia",
    "tokyo": "Asia",
    "sydney": "Asia",
    "overlap": "Overlap",
    "off": "Off",
    "other": "Off",
}

FORBIDDEN_ARG_KEYS = {"user_id", "userid", "userId", "current_user", "currentuser"}

COMPACT_OVERVIEW_KEYS = (
    "total_trades",
    "win_count",
    "loss_count",
    "breakeven_count",
    "win_rate",
    "total_pnl",
    "avg_win",
    "avg_loss",
    "avg_trade",
    "profit_factor",
    "expectancy",
    "largest_win",
    "largest_loss",
    "max_drawdown",
    "max_drawdown_pct",
    "current_streak",
    "current_streak_type",
    "best_day_pnl",
    "worst_day_pnl",
    "trading_days",
)


def sanitize_tool_args(raw: dict | None) -> dict:
    if not isinstance(raw, dict):
        return {}
    return {key: value for key, value in raw.items() if key not in FORBIDDEN_ARG_KEYS}


def parse_datetime(value: object) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    text = str(value).strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        try:
            parsed = datetime.strptime(text[:10], "%Y-%m-%d")
        except ValueError:
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def normalize_session(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    mapped = SESSION_ALIASES.get(text.lower())
    if mapped:
        return mapped
    for name in ("Asia", "London", "Overlap", "NY", "Off"):
        if text.lower() == name.lower():
            return name
    return text


def normalize_side(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip().lower()
    if text in {"long", "buy"}:
        return TradeSide.long.value
    if text in {"short", "sell"}:
        return TradeSide.short.value
    return None


def compact_overview(overview: dict) -> dict:
    return {key: overview.get(key) for key in COMPACT_OVERVIEW_KEYS}


def trade_session_label(trade) -> str | None:
    if getattr(trade, "session", None):
        return str(trade.session)
    opened = getattr(trade, "opened_at", None)
    if opened is None:
        return None
    return _session_for_hour(opened.hour)
