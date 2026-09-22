from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone


def _session_for_hour(hour: int) -> str:
    if 0 <= hour < 7:
        return "Asia"
    if 7 <= hour < 12:
        return "London"
    if 12 <= hour < 16:
        return "Overlap"
    if 16 <= hour < 21:
        return "NY"
    return "Off"


def r_multiple(trade) -> float | None:
    pnl = getattr(trade, "pnl", None)
    risk = getattr(trade, "risk_amount", None)
    if pnl is None or risk is None or float(risk) == 0:
        return None
    return round(float(pnl) / float(risk), 3)


def _as_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def trade_id(trade) -> str:
    return str(getattr(trade, "id"))


def pnl_of(trade) -> float:
    return float(getattr(trade, "pnl", 0) or 0)


def side_of(trade) -> str | None:
    side = getattr(trade, "side", None)
    if side is None:
        return None
    value = getattr(side, "value", side)
    text = str(value).strip().lower()
    return text or None


def setup_of(trade) -> str | None:
    tag = getattr(trade, "setup_tag", None)
    if tag and str(tag).strip():
        return str(tag).strip()
    tags = list(getattr(trade, "setup_tags", None) or [])
    for item in tags:
        if item and str(item).strip():
            return str(item).strip()
    return None


def symbol_of(trade) -> str | None:
    symbol = getattr(trade, "symbol", None)
    if symbol and str(symbol).strip():
        return str(symbol).strip().upper()
    return None


def session_of(trade) -> str | None:
    raw = getattr(trade, "session", None)
    if raw and str(raw).strip():
        text = str(raw).strip()
        aliases = {
            "ny": "NY",
            "nyc": "NY",
            "new york": "NY",
            "newyork": "NY",
            "london": "London",
            "asia": "Asia",
            "asian": "Asia",
            "overlap": "Overlap",
            "off": "Off",
        }
        return aliases.get(text.lower(), text)
    opened = _as_utc(getattr(trade, "opened_at", None))
    if opened is None:
        return None
    return _session_for_hour(opened.hour)


def hour_of(trade) -> str | None:
    opened = _as_utc(getattr(trade, "opened_at", None))
    if opened is None:
        return None
    session = session_of(trade) or "Session"
    hour = opened.hour
    if session == "NY" and hour == 16:
        return "NY first hour"
    return f"{session} {hour:02d}:00"


def opened_at(trade) -> datetime | None:
    return _as_utc(getattr(trade, "opened_at", None))


def avg_r(trades: list) -> float | None:
    values = [r_multiple(t) for t in trades]
    values = [v for v in values if v is not None]
    if not values:
        return None
    return round(sum(values) / len(values), 3)


def expectancy_r(trades: list) -> float | None:
    return avg_r(trades)


def win_rate(trades: list) -> float:
    if not trades:
        return 0.0
    wins = sum(1 for t in trades if pnl_of(t) > 0)
    return round(wins / len(trades) * 100, 1)


def loss_pnl(trades: list) -> float:
    return round(sum(pnl_of(t) for t in trades if pnl_of(t) < 0), 2)


def profit_pnl(trades: list) -> float:
    return round(sum(pnl_of(t) for t in trades if pnl_of(t) > 0), 2)


def cohort_metrics(trades: list) -> dict:
    losses = [t for t in trades if pnl_of(t) < 0]
    wins = [t for t in trades if pnl_of(t) > 0]
    r_vals = [r_multiple(t) for t in trades]
    r_vals = [v for v in r_vals if v is not None]
    return {
        "n": len(trades),
        "wins": len(wins),
        "losses": len(losses),
        "win_rate": win_rate(trades),
        "pnl": round(sum(pnl_of(t) for t in trades), 2),
        "avg_r": round(sum(r_vals) / len(r_vals), 3) if r_vals else None,
        "loss_pnl": round(sum(pnl_of(t) for t in losses), 2),
        "ids": [trade_id(t) for t in trades],
    }


def recency_share(trades: list, all_trades: list, days: int = 14) -> float:
    if not trades:
        return 0.0
    stamps = [opened_at(t) for t in all_trades]
    stamps = [s for s in stamps if s is not None]
    if not stamps:
        return 0.0
    latest = max(stamps)
    cutoff = latest.timestamp() - days * 86400
    recent = sum(1 for t in trades if (opened_at(t) or latest).timestamp() >= cutoff)
    return recent / len(trades)


def group_by(trades: list, key_fn) -> dict[str, list]:
    buckets: dict[str, list] = defaultdict(list)
    for trade in trades:
        key = key_fn(trade)
        if key:
            buckets[str(key)].append(trade)
    return dict(buckets)


def fmt_r(value: float | None) -> str:
    if value is None:
        return "—"
    sign = "+" if value > 0 else ""
    return f"{sign}{value:.2f}R"


def fmt_pct(value: float | None, signed: bool = False) -> str:
    if value is None:
        return "—"
    if signed:
        sign = "+" if value > 0 else ""
        return f"{sign}{value:.0f}%"
    return f"{value:.0f}%"


def fmt_count_delta(value: float) -> str:
    sign = "+" if value > 0 else ""
    return f"{sign}{value:.0f}%"
