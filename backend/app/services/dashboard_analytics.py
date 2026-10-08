"""Dashboard performance aggregations.

Computed once from the closed trades already loaded by full_analytics.
Hour-of-day and weekday use the trade entry time in the user's timezone.
Month, year, and heatmap days use the realized trade date (close, else entry)
in that same timezone — the same close-or-open choice as the calendar.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.services.masters_service import parse_moods, parse_went_well
from app.services.stats_service import profit_factor

WEEKDAYS = ("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")
MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
ALL_STRATEGIES = "__all__"
NO_STRATEGY = "__none__"
MAX_MONTHS = 24
MAX_SYMBOLS = 80
MAX_BREAKDOWN = 80
MAX_DURATION_POINTS = 600


def _zone(name: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(name or "UTC")
    except ZoneInfoNotFoundError:
        return ZoneInfo("UTC")


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _local(dt: datetime, tz: ZoneInfo) -> datetime:
    return _as_utc(dt).astimezone(tz)


def _calendar_date(dt: datetime | None) -> date | None:
    """Date-only filter bounds stay on the calendar date the client sent."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.date()
    return dt.astimezone(timezone.utc).date()


def _entry(trade) -> datetime:
    return trade.opened_at


def _realized(trade) -> datetime:
    return trade.closed_at or trade.opened_at


def _pnl(trade) -> float:
    return float(trade.pnl or 0)


def _labels(value) -> list[str]:
    if isinstance(value, list):
        return parse_went_well(value)
    return parse_went_well(value)


def _rules(trade) -> list[str]:
    return _labels(getattr(trade, "rules_broken", None) or [])


def _strategy_id(trade) -> str:
    name = (getattr(trade, "strategy_name", None) or "").strip()
    return name or NO_STRATEGY


def _strategy_label(key: str) -> str:
    if key == NO_STRATEGY:
        return "No strategy"
    return key


def _side(trade) -> str | None:
    side = getattr(trade, "side", None)
    if side is None:
        return None
    value = getattr(side, "value", side)
    text = str(value or "").strip()
    return text or None


def _timeframe(trade) -> str | None:
    for attr in ("entry_timeframe", "analysis_timeframe"):
        raw = getattr(trade, attr, None)
        text = str(raw or "").strip()
        if text:
            return text
    return None


def _moods(trade) -> list[str]:
    extra = getattr(trade, "extra", None) or {}
    stored = extra.get("moods") if isinstance(extra, dict) else None
    if stored:
        return parse_moods(stored)
    return parse_moods(getattr(trade, "mood", None))


def _went_well(trade) -> list[str]:
    extra = getattr(trade, "extra", None) or {}
    if not isinstance(extra, dict):
        return []
    return parse_went_well(extra.get("went_well"))


def _empty_counts() -> dict:
    return {
        "trades": 0,
        "wins": 0,
        "losses": 0,
        "breakeven": 0,
        "win_rate": None,
        "pnl": None,
        "avg_pnl": None,
        "profit_factor": None,
        "gross_profit": None,
        "avg_win": None,
        "avg_loss": None,
    }


def _counts(group: list) -> dict:
    """Shared bucket stats. Expectancy is avg_pnl (sum of P&L / trades)."""
    trades = len(group)
    if not trades:
        return _empty_counts()
    wins_pnl: list[float] = []
    losses_pnl: list[float] = []
    pnl_sum = 0.0
    for trade in group:
        value = _pnl(trade)
        pnl_sum += value
        if value > 0:
            wins_pnl.append(value)
        elif value < 0:
            losses_pnl.append(value)
    wins = len(wins_pnl)
    losses = len(losses_pnl)
    pnl = round(pnl_sum, 2)
    gross_loss = abs(sum(losses_pnl))
    return {
        "trades": trades,
        "wins": wins,
        "losses": losses,
        "breakeven": trades - wins - losses,
        "win_rate": round(wins / trades * 100, 1),
        "pnl": pnl,
        "avg_pnl": round(pnl / trades, 2),
        "profit_factor": profit_factor(group) if gross_loss > 0 else None,
        "gross_profit": round(sum(wins_pnl), 2),
        "avg_win": round(sum(wins_pnl) / wins, 2) if wins else None,
        "avg_loss": round(sum(losses_pnl) / losses, 2) if losses else None,
    }


def _named(group: list, name: str) -> dict:
    return {"name": name, **_counts(group)}


def _best(rows: list[dict]) -> dict | None:
    eligible = [row for row in rows if row["trades"] > 0 and row["win_rate"] is not None]
    if not eligible:
        return None
    return max(eligible, key=lambda row: (row["win_rate"], row["pnl"] or 0, row["trades"]))


def _group_by(trades: list, key_fn) -> list[dict]:
    buckets: dict[str, list] = defaultdict(list)
    for trade in trades:
        key = key_fn(trade)
        if not key:
            continue
        buckets[key].append(trade)
    rows = [_named(group, name) for name, group in buckets.items()]
    rows.sort(key=lambda row: ((row["pnl"] or 0), row["trades"]), reverse=True)
    return rows


def _multi_group(trades: list, labels_fn) -> list[dict]:
    buckets: dict[str, list] = defaultdict(list)
    for trade in trades:
        for label in labels_fn(trade):
            buckets[label].append(trade)
    rows = [_named(group, name) for name, group in buckets.items()]
    rows.sort(key=lambda row: (row["trades"], row["pnl"] or 0), reverse=True)
    return rows


def _iter_months(start: date, end: date):
    year, month = start.year, start.month
    guard = 0
    while (year, month) <= (end.year, end.month) and guard < 48:
        yield year, month
        month += 1
        if month == 13:
            month = 1
            year += 1
        guard += 1


def _month_rows(trades: list, tz: ZoneInfo, start: date, end: date) -> list[dict]:
    buckets: dict[tuple[int, int], list] = defaultdict(list)
    for trade in trades:
        local = _local(_realized(trade), tz)
        buckets[(local.year, local.month)].append(trade)
    months = list(_iter_months(start, end))
    if len(months) > MAX_MONTHS:
        months = months[-MAX_MONTHS:]
    rows = []
    for year, month in months:
        group = buckets.get((year, month), [])
        rows.append(
            {
                "year": year,
                "month": month,
                "label": f"{year}/{month:02d}",
                "short_label": MONTHS[month - 1],
                **_counts(group),
            }
        )
    return rows


def _weekly(trades: list, tz: ZoneInfo) -> list[dict]:
    buckets: dict[int, list] = defaultdict(list)
    for trade in trades:
        local = _local(_entry(trade), tz)
        buckets[(local.weekday() + 1) % 7].append(trade)
    return [{"day": WEEKDAYS[index], "weekday": index, **_counts(buckets.get(index, []))} for index in range(7)]


def _hourly(trades: list, tz: ZoneInfo) -> list[dict]:
    buckets: dict[int, list] = defaultdict(list)
    for trade in trades:
        buckets[_local(_entry(trade), tz).hour].append(trade)
    rows = []
    for hour in range(24):
        rows.append({"hour": hour, "label": f"{hour:02d}:00", **_counts(buckets.get(hour, []))})
    return rows


def _yearly(trades: list, tz: ZoneInfo, year: int) -> dict:
    buckets: dict[int, list] = defaultdict(list)
    for trade in trades:
        local = _local(_realized(trade), tz)
        if local.year == year:
            buckets[local.month].append(trade)
    months = []
    for month in range(1, 13):
        months.append(
            {
                "year": year,
                "month": month,
                "label": MONTHS[month - 1],
                "short_label": MONTHS[month - 1],
                **_counts(buckets.get(month, [])),
            }
        )
    year_trades = [trade for group in buckets.values() for trade in group]
    return {"year": year, "months": months, "total": _counts(year_trades)}


def _resolve_year(trades: list, tz: ZoneInfo, date_to: datetime | None) -> int:
    bound = _calendar_date(date_to)
    if bound is not None:
        return bound.year
    if trades:
        latest = max(_local(_realized(trade), tz) for trade in trades)
        return latest.year
    return datetime.now(tz).year


def _heatmap(trades: list, tz: ZoneInfo, date_from: datetime | None, date_to: datetime | None) -> dict:
    today = datetime.now(tz).date()
    range_end = _calendar_date(date_to) or today
    if range_end > today:
        range_end = today
    window_start = range_end - timedelta(days=364)
    range_start = _calendar_date(date_from) or window_start
    if range_start < window_start:
        range_start = window_start
    if range_start > range_end:
        range_start = range_end

    buckets: dict[date, list] = defaultdict(list)
    for trade in trades:
        day = _local(_realized(trade), tz).date()
        if window_start <= day <= range_end:
            buckets[day].append(trade)

    days = []
    for day in sorted(buckets):
        days.append(
            {
                "date": day.isoformat(),
                "in_range": range_start <= day <= range_end,
                **_counts(buckets[day]),
            }
        )
    return {
        "start": window_start.isoformat(),
        "end": range_end.isoformat(),
        "range_start": range_start.isoformat(),
        "range_end": range_end.isoformat(),
        "days": days,
    }


def _duration_points(trades: list) -> list[dict]:
    points: list[dict] = []
    for trade in trades:
        opened = getattr(trade, "opened_at", None)
        closed = getattr(trade, "closed_at", None)
        if opened is None or closed is None:
            continue
        seconds = int((_as_utc(closed) - _as_utc(opened)).total_seconds())
        points.append({"seconds": max(0, seconds), "pnl": round(_pnl(trade), 2)})
    points.sort(key=lambda point: (point["seconds"], point["pnl"]))
    if len(points) <= MAX_DURATION_POINTS:
        return points
    step = (len(points) - 1) / (MAX_DURATION_POINTS - 1)
    return [points[round(index * step)] for index in range(MAX_DURATION_POINTS)]


def _strategies(trades: list) -> list[dict]:
    buckets: dict[str, list] = defaultdict(list)
    for trade in trades:
        buckets[_strategy_id(trade)].append(trade)
    rows = []
    for key, group in buckets.items():
        rows.append({"id": key, "name": _strategy_label(key), **_counts(group)})
    rows.sort(key=lambda row: ((row["pnl"] or 0), row["trades"]), reverse=True)
    return rows


def _discipline_for(group: list) -> dict:
    followed = 0
    violated = 0
    rule_counts: dict[str, int] = defaultdict(int)
    for trade in group:
        broken = _rules(trade)
        if broken:
            violated += 1
            for rule in broken:
                rule_counts[rule] += 1
        else:
            followed += 1
    trades = len(group)
    most_rule = None
    most_count = 0
    if rule_counts:
        most_rule, most_count = max(rule_counts.items(), key=lambda item: (item[1], item[0]))
    return {
        "trades": trades,
        "followed": followed,
        "violated": violated,
        "discipline_rate": round(followed / trades * 100, 1) if trades else None,
        "most_violated_rule": most_rule,
        "most_violated_count": most_count,
    }


def _discipline(trades: list) -> dict:
    buckets: dict[str, list] = defaultdict(list)
    for trade in trades:
        buckets[_strategy_id(trade)].append(trade)
    options = [{"id": ALL_STRATEGIES, "label": "All strategies"}]
    by_strategy = {ALL_STRATEGIES: _discipline_for(trades)}
    for key in sorted(buckets, key=lambda item: (item == NO_STRATEGY, _strategy_label(item).lower())):
        options.append({"id": key, "label": _strategy_label(key)})
        by_strategy[key] = _discipline_for(buckets[key])
    return {"options": options, "by_strategy": by_strategy}


def _symbols(trades: list) -> list[dict]:
    buckets: dict[str, list] = defaultdict(list)
    for trade in trades:
        symbol = str(getattr(trade, "symbol", "") or "").strip().upper()
        if symbol:
            buckets[symbol].append(trade)
    rows = [{"symbol": symbol, **_counts(group)} for symbol, group in buckets.items()]
    rows.sort(key=lambda row: ((row["pnl"] or 0), row["trades"]), reverse=True)
    return rows[:MAX_SYMBOLS]


def _mistake(trades: list) -> dict | None:
    buckets: dict[str, list] = defaultdict(list)
    for trade in trades:
        for rule in _rules(trade):
            buckets[rule].append(trade)
    if not buckets:
        return None
    name, group = max(buckets.items(), key=lambda item: (len(item[1]), -sum(_pnl(t) for t in item[1])))
    return {"name": name, "occurrences": len(group), **_counts(group)}


def _insights(trades: list, strategies: list[dict]) -> dict:
    named = [row for row in strategies if row["id"] != NO_STRATEGY]
    sessions = _group_by(trades, lambda trade: (getattr(trade, "session", None) or "").strip() or None)
    timeframes = _group_by(trades, _timeframe)
    entries = _group_by(trades, lambda trade: (getattr(trade, "entry_condition", None) or "").strip() or None)
    exits = _group_by(trades, lambda trade: (getattr(trade, "exit_condition", None) or "").strip() or None)
    types = _group_by(trades, lambda trade: (getattr(trade, "trade_type", None) or "").strip() or None)
    sides = _group_by(trades, _side)
    for row in sides:
        row["name"] = row["name"].replace("_", " ").title()
    moods = _multi_group(trades, _moods)
    went_well = _multi_group(trades, _went_well)
    return {
        "best_strategy": _best(named) or _best(strategies),
        "best_session": _best(sessions),
        "best_timeframe": _best(timeframes),
        "most_common_mistake": _mistake(trades),
        "best_entry": _best(entries),
        "best_exit": _best(exits),
        "sides": sides,
        "trade_types": types[:MAX_BREAKDOWN],
        "moods": moods[:MAX_BREAKDOWN],
        "went_well": went_well[:8],
        "sessions": sessions[:MAX_BREAKDOWN],
        "timeframes": timeframes[:MAX_BREAKDOWN],
        "entries": entries[:MAX_BREAKDOWN],
        "exits": exits[:MAX_BREAKDOWN],
        "mistakes": _multi_group(trades, _rules)[:MAX_BREAKDOWN],
    }


def build_performance(
    trades: list,
    timezone_name: str | None,
    *,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> dict:
    tz = _zone(timezone_name)
    year = _resolve_year(trades, tz, date_to)
    strategies = _strategies(trades)

    month_start = _calendar_date(date_from)
    month_end = _calendar_date(date_to)
    if trades and (month_start is None or month_end is None):
        realized = [_local(_realized(trade), tz).date() for trade in trades]
        month_start = month_start or min(realized).replace(day=1)
        month_end = month_end or max(realized)
    if month_start and month_end and month_start > month_end:
        month_start, month_end = month_end, month_start

    monthly = _month_rows(trades, tz, month_start, month_end) if month_start and month_end else []

    return {
        "has_trades": bool(trades),
        "timezone": str(tz),
        "weekly_win_rate": _weekly(trades, tz),
        "yearly": _yearly(trades, tz, year),
        "hourly": _hourly(trades, tz),
        "monthly_profit": monthly,
        "heatmap": _heatmap(trades, tz, date_from, date_to),
        "duration_pnl": _duration_points(trades),
        "strategies": strategies,
        "rule_discipline": _discipline(trades),
        "symbols": _symbols(trades),
        "insights": _insights(trades, strategies),
    }
