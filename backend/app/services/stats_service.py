"""Deterministic number-crunching used by analytics endpoints, the rule-based
insight engine, and every AI agent. Nothing in here calls an LLM — agents only
ever receive the *output* of these functions so they can never invent a stat.
"""

import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.mood import MoodCheckin
from app.models.trade import Trade, TradeStatus


def _closed_trades(
    db: Session,
    user_id: uuid.UUID,
    since: datetime | None = None,
    account_id: uuid.UUID | None = None,
) -> list[Trade]:
    stmt = select(Trade).where(
        Trade.user_id == user_id,
        Trade.status == TradeStatus.closed,
        Trade.pnl.is_not(None),
        Trade.is_deleted.is_(False),
    )
    if account_id is not None:
        stmt = stmt.where(Trade.account_id == account_id)
    if since:
        stmt = stmt.where(Trade.opened_at >= since)
    stmt = stmt.order_by(Trade.opened_at.asc())
    return list(db.scalars(stmt).all())


def _open_trades(
    db: Session,
    user_id: uuid.UUID,
    account_id: uuid.UUID | None = None,
) -> list[Trade]:
    stmt = select(Trade).where(
        Trade.user_id == user_id,
        Trade.status == TradeStatus.open,
        Trade.is_deleted.is_(False),
    )
    if account_id is not None:
        stmt = stmt.where(Trade.account_id == account_id)
    return list(db.scalars(stmt).all())


def win_rate(trades: list[Trade]) -> float:
    if not trades:
        return 0.0
    wins = sum(1 for t in trades if float(t.pnl or 0) > 0)
    return round(wins / len(trades) * 100, 1)


def profit_factor(trades: list[Trade]) -> float:
    wins = sum(float(t.pnl or 0) for t in trades if float(t.pnl or 0) > 0)
    losses = abs(sum(float(t.pnl or 0) for t in trades if float(t.pnl or 0) < 0))
    if losses > 0:
        return round(wins / losses, 2)
    if wins > 0:
        return round(wins, 2)
    return 0.0


def expectancy(trades: list[Trade]) -> float:
    if not trades:
        return 0.0
    return round(sum(float(t.pnl or 0) for t in trades) / len(trades), 2)


def empty_overview() -> dict:
    return {
        "total_trades": 0,
        "win_rate": 0.0,
        "total_pnl": 0.0,
        "avg_win": 0.0,
        "avg_loss": 0.0,
        "avg_trade": 0.0,
        "profit_factor": 0.0,
        "expectancy": 0.0,
        "largest_win": 0.0,
        "largest_loss": 0.0,
        "total_fees": 0.0,
        "trading_days": 0,
        "current_streak": 0,
        "current_streak_type": "none",
        "best_day_pnl": 0.0,
        "worst_day_pnl": 0.0,
        "max_drawdown": 0.0,
        "max_drawdown_pct": 0.0,
        "avg_execution_score": None,
        "avg_r_multiple": None,
    }


def overview_from_trades(trades: list[Trade]) -> dict:
    if not trades:
        return empty_overview()

    wins = [float(t.pnl) for t in trades if float(t.pnl) > 0]
    losses = [float(t.pnl) for t in trades if float(t.pnl) < 0]
    total_pnl = round(sum(float(t.pnl) for t in trades), 2)
    total_fees = round(sum(float(t.fees or 0) for t in trades), 2)

    streak_type = "none"
    streak = 0
    for t in reversed(trades):
        pnl = float(t.pnl)
        this_type = "win" if pnl > 0 else "loss" if pnl < 0 else "none"
        if streak == 0:
            streak_type = this_type
            streak = 1 if this_type != "none" else 0
            if this_type == "none":
                break
        elif this_type == streak_type:
            streak += 1
        else:
            break

    daily_pnl = daily_pnl_map(trades)
    best_day = max(daily_pnl.values()) if daily_pnl else 0.0
    worst_day = min(daily_pnl.values()) if daily_pnl else 0.0
    dd, dd_pct = max_drawdown_from_trades(trades)

    r_vals = []
    exec_scores = []
    from app.services.trade_scores import execution_score, r_multiple

    for t in trades:
        r = r_multiple(t)
        if r is not None:
            r_vals.append(r)
        exec_scores.append(execution_score(t))

    return {
        "total_trades": len(trades),
        "win_rate": win_rate(trades),
        "total_pnl": total_pnl,
        "avg_win": round(sum(wins) / len(wins), 2) if wins else 0.0,
        "avg_loss": round(sum(losses) / len(losses), 2) if losses else 0.0,
        "avg_trade": expectancy(trades),
        "profit_factor": profit_factor(trades),
        "expectancy": expectancy(trades),
        "largest_win": round(max(wins), 2) if wins else 0.0,
        "largest_loss": round(min(losses), 2) if losses else 0.0,
        "total_fees": total_fees,
        "trading_days": len(daily_pnl),
        "current_streak": streak,
        "current_streak_type": streak_type,
        "best_day_pnl": round(best_day, 2),
        "worst_day_pnl": round(worst_day, 2),
        "max_drawdown": dd,
        "max_drawdown_pct": dd_pct,
        "avg_execution_score": round(sum(exec_scores) / len(exec_scores), 1) if exec_scores else None,
        "avg_r_multiple": round(sum(r_vals) / len(r_vals), 3) if r_vals else None,
    }


def overview_stats(
    db: Session,
    user_id: uuid.UUID,
    account_id: uuid.UUID | None = None,
) -> dict:
    trades = _closed_trades(db, user_id, account_id=account_id)
    return overview_from_trades(trades)


def daily_pnl_map(trades: list[Trade]) -> dict[date, float]:
    out: dict[date, float] = defaultdict(float)
    for t in trades:
        d = (t.closed_at or t.opened_at).date()
        out[d] += float(t.pnl or 0)
    return dict(out)


def equity_curve(trades: list[Trade]) -> list[dict]:
    """Cumulative P&L series ordered by close/open time."""
    ordered = sorted(trades, key=lambda t: t.closed_at or t.opened_at)
    running = 0.0
    series: list[dict] = []
    for t in ordered:
        running = round(running + float(t.pnl or 0), 2)
        ts = t.closed_at or t.opened_at
        series.append({
            "date": ts.date().isoformat(),
            "value": running,
            "symbol": t.symbol,
        })
    return series


def by_hour_stats(trades: list[Trade]) -> list[dict]:
    buckets: dict[int, list[Trade]] = defaultdict(list)
    for t in trades:
        buckets[t.opened_at.hour].append(t)
    result = []
    for hour in sorted(buckets):
        group = buckets[hour]
        result.append({
            "bucket": f"{hour:02d}:00",
            "trades": len(group),
            "win_rate": win_rate(group),
            "pnl": round(sum(float(t.pnl or 0) for t in group), 2),
        })
    return result


def by_day_of_week_stats(trades: list[Trade]) -> list[dict]:
    names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    buckets: dict[int, list[Trade]] = defaultdict(list)
    for t in trades:
        buckets[t.opened_at.weekday()].append(t)
    result = []
    for idx, name in enumerate(names):
        group = buckets.get(idx, [])
        result.append({
            "bucket": name,
            "trades": len(group),
            "win_rate": win_rate(group),
            "pnl": round(sum(float(t.pnl or 0) for t in group), 2),
        })
    return result


def by_setup_stats(trades: list[Trade]) -> list[dict]:
    now = trades[0].opened_at if trades else datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    last_30 = now - timedelta(days=30)
    prior_30 = now - timedelta(days=60)

    buckets: dict[str, list[Trade]] = defaultdict(list)
    for t in trades:
        if t.setup_tag:
            buckets[t.setup_tag].append(t)

    result = []
    for setup, group in buckets.items():
        last_30_group = [t for t in group if t.opened_at >= last_30]
        prior_30_group = [t for t in group if prior_30 <= t.opened_at < last_30]
        result.append({
            "setup_tag": setup,
            "trades": len(group),
            "win_rate": win_rate(group),
            "pnl": round(sum(float(t.pnl or 0) for t in group), 2),
            "win_rate_last_30d": win_rate(last_30_group),
            "win_rate_prior_30d": win_rate(prior_30_group),
        })
    result.sort(key=lambda x: x["pnl"], reverse=True)
    return result


def by_symbol_stats(trades: list[Trade], limit: int = 12) -> list[dict]:
    buckets: dict[str, list[Trade]] = defaultdict(list)
    for t in trades:
        buckets[t.symbol.upper()].append(t)

    result = []
    for symbol, group in buckets.items():
        result.append({
            "bucket": symbol,
            "trades": len(group),
            "win_rate": win_rate(group),
            "pnl": round(sum(float(t.pnl or 0) for t in group), 2),
        })
    result.sort(key=lambda x: abs(x["pnl"]), reverse=True)
    return result[:limit]


def mood_vs_pnl_stats(db: Session, user_id: uuid.UUID, trades: list[Trade]) -> list[dict]:
    checkins = db.scalars(select(MoodCheckin).where(MoodCheckin.user_id == user_id)).all()
    mood_by_date = {c.date: c.mood_score for c in checkins}

    buckets: dict[int, list[Trade]] = defaultdict(list)
    for t in trades:
        mood = t.mood
        score = None
        if mood and mood.isdigit():
            score = int(mood)
        elif t.opened_at.date() in mood_by_date:
            score = mood_by_date[t.opened_at.date()]
        if score is not None:
            buckets[score].append(t)

    result = []
    for score in sorted(buckets):
        group = buckets[score]
        result.append({
            "mood_score": score,
            "trades": len(group),
            "avg_pnl": round(sum(float(t.pnl or 0) for t in group) / len(group), 2) if group else 0.0,
            "win_rate": win_rate(group),
        })
    return result


def max_drawdown_from_trades(trades: list[Trade]) -> tuple[float, float]:
    curve = equity_curve(trades)
    if not curve:
        return 0.0, 0.0
    peak = curve[0]["value"]
    max_dd = 0.0
    for pt in curve:
        peak = max(peak, pt["value"])
        dd = peak - pt["value"]
        max_dd = max(max_dd, dd)
    # pct relative to peak equity cushion (use abs peak or 1)
    base = abs(peak) if abs(peak) > 1 else 1.0
    return round(max_dd, 2), round((max_dd / base) * 100, 2)


def _session_for_hour(hour: int) -> str:
    # UTC approximation: Asia 00-07, London 07-12, Overlap 12-16, NY 16-21, Off 21-24
    if 0 <= hour < 7:
        return "Asia"
    if 7 <= hour < 12:
        return "London"
    if 12 <= hour < 16:
        return "Overlap"
    if 16 <= hour < 21:
        return "NY"
    return "Off"


def by_session_stats(trades: list[Trade]) -> list[dict]:
    buckets: dict[str, list[Trade]] = defaultdict(list)
    for t in trades:
        buckets[_session_for_hour(t.opened_at.hour)].append(t)
    order = ["Asia", "London", "Overlap", "NY", "Off"]
    result = []
    for name in order:
        group = buckets.get(name, [])
        result.append({
            "bucket": name,
            "trades": len(group),
            "win_rate": win_rate(group),
            "pnl": round(sum(float(t.pnl or 0) for t in group), 2),
        })
    return result


def expectancy_by_tag(trades: list[Trade], tag_field: str = "setup") -> list[dict]:
    from app.services.trade_scores import r_multiple

    buckets: dict[str, list[Trade]] = defaultdict(list)
    for t in trades:
        if tag_field == "emotion":
            tags = list(t.emotion_tags or []) or list(t.rules_broken or [])
        else:
            tags = list(t.setup_tags or [])
            if t.setup_tag and t.setup_tag not in tags:
                tags.append(t.setup_tag)
        for tag in tags:
            buckets[tag].append(t)

    rows = []
    for tag, group in buckets.items():
        r_vals = [r_multiple(t) for t in group]
        r_vals = [r for r in r_vals if r is not None]
        rows.append({
            "tag": tag,
            "tag_type": tag_field,
            "trades": len(group),
            "win_rate": win_rate(group),
            "pnl": round(sum(float(t.pnl or 0) for t in group), 2),
            "expectancy": expectancy(group),
            "avg_r": round(sum(r_vals) / len(r_vals), 3) if r_vals else None,
        })
    rows.sort(key=lambda r: (r["avg_r"] is not None, r["avg_r"] or r["expectancy"]), reverse=True)
    return rows


def r_distribution(trades: list[Trade]) -> list[dict]:
    from app.services.trade_scores import r_multiple

    edges = [-3, -2, -1, -0.5, 0, 0.5, 1, 1.5, 2, 3, 5]
    labels = ["<-3", "-3:-2", "-2:-1", "-1:-0.5", "-0.5:0", "0:0.5", "0.5:1", "1:1.5", "1.5:2", "2:3", "3:5", ">5"]
    counts = [0] * len(labels)
    for t in trades:
        r = r_multiple(t)
        if r is None:
            continue
        placed = False
        for i, edge in enumerate(edges):
            if r < edge:
                counts[i] += 1
                placed = True
                break
        if not placed:
            counts[-1] += 1
    return [{"bucket": labels[i], "count": counts[i]} for i in range(len(labels))]


def edge_finder(trades: list[Trade]) -> dict:
    if not trades:
        return {
            "best_day": None,
            "worst_day": None,
            "best_hour": None,
            "worst_symbol": None,
            "best_setup": None,
            "worst_emotion": None,
            "best_rr": None,
        }

    by_day = by_day_of_week_stats(trades)
    best_day = max(by_day, key=lambda x: x["pnl"]) if by_day else None
    worst_day = min(by_day, key=lambda x: x["pnl"]) if by_day else None
    by_hour = by_hour_stats(trades)
    best_hour = max(by_hour, key=lambda x: x["pnl"]) if by_hour else None
    by_sym = by_symbol_stats(trades)
    worst_symbol = min(by_sym, key=lambda x: x["pnl"]) if by_sym else None
    setups = expectancy_by_tag(trades, "setup")
    emotions = expectancy_by_tag(trades, "emotion")
    best_setup = setups[0] if setups else None
    worst_emotion = emotions[-1] if emotions else None

    from app.services.trade_scores import r_multiple

    best_rr = None
    for t in trades:
        r = r_multiple(t)
        if r is None:
            continue
        if best_rr is None or r > best_rr["r"]:
            best_rr = {"symbol": t.symbol, "r": r, "pnl": float(t.pnl or 0)}

    return {
        "best_day": best_day,
        "worst_day": worst_day,
        "best_hour": best_hour,
        "worst_symbol": worst_symbol,
        "best_setup": best_setup,
        "worst_emotion": worst_emotion,
        "best_rr": best_rr,
    }


def performance_timeline(trades: list[Trade]) -> list[dict]:
    from app.services.trade_scores import execution_score, health_score

    months: dict[str, list[Trade]] = defaultdict(list)
    for t in trades:
        key = (t.closed_at or t.opened_at).strftime("%Y-%m")
        months[key].append(t)
    rows = []
    for month in sorted(months):
        group = months[month]
        execs = [execution_score(t) for t in group]
        healths = [health_score(t) for t in group]
        healths = [h for h in healths if h is not None]
        rows.append({
            "month": month,
            "trades": len(group),
            "execution": round(sum(execs) / len(execs), 1) if execs else None,
            "health": round(sum(healths) / len(healths), 1) if healths else None,
            "pnl": round(sum(float(t.pnl or 0) for t in group), 2),
        })
    return rows


def _as_utc(dt: datetime) -> datetime:
    """Normalize naive/aware datetimes so range filters never mix tz kinds."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def filter_trades(
    trades: list[Trade],
    *,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    setup_tag: str | None = None,
    emotion_tag: str | None = None,
    symbol: str | None = None,
    session: str | None = None,
) -> list[Trade]:
    out = trades
    if date_from:
        start = _as_utc(date_from)
        out = [t for t in out if t.opened_at and _as_utc(t.opened_at) >= start]
    if date_to:
        # Inclusive end-of-day when the client sends a date-only bound (00:00:00)
        end = _as_utc(date_to)
        if (
            end.hour == 0
            and end.minute == 0
            and end.second == 0
            and end.microsecond == 0
        ):
            end = end + timedelta(days=1) - timedelta(microseconds=1)
        out = [t for t in out if t.opened_at and _as_utc(t.opened_at) <= end]
    if setup_tag:
        out = [
            t
            for t in out
            if t.setup_tag == setup_tag or setup_tag in (t.setup_tags or [])
        ]
    if emotion_tag:
        out = [t for t in out if emotion_tag in (t.emotion_tags or []) or emotion_tag in (t.rules_broken or [])]
    if symbol:
        out = [t for t in out if t.symbol.upper() == symbol.upper()]
    if session:
        out = [t for t in out if _session_for_hour(t.opened_at.hour) == session]
    return out


def full_analytics(
    db: Session,
    user_id: uuid.UUID,
    account_id: uuid.UUID | None = None,
    *,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    setup_tag: str | None = None,
    emotion_tag: str | None = None,
    symbol: str | None = None,
    session: str | None = None,
    is_pro: bool = True,
) -> dict:
    trades = _closed_trades(db, user_id, account_id=account_id)
    trades = filter_trades(
        trades,
        date_from=date_from,
        date_to=date_to,
        setup_tag=setup_tag,
        emotion_tag=emotion_tag,
        symbol=symbol,
        session=session,
    )
    by_tag = expectancy_by_tag(trades, "setup")
    by_emotion = expectancy_by_tag(trades, "emotion")
    return {
        "overview": overview_from_trades(trades),
        "by_hour": by_hour_stats(trades),
        "by_day_of_week": by_day_of_week_stats(trades),
        "by_setup": by_setup_stats(trades),
        "by_symbol": by_symbol_stats(trades),
        "by_session": by_session_stats(trades),
        "mood_vs_pnl": mood_vs_pnl_stats(db, user_id, trades),
        "equity_curve": equity_curve(trades),
        "r_distribution": r_distribution(trades),
        "expectancy_by_tag": by_tag,
        "expectancy_by_emotion": by_emotion,
        "expectancy_truncated": False,
        "expectancy_total_tags": len(by_tag),
        "edge_finder": edge_finder(trades),
        "performance_timeline": performance_timeline(trades),
        "plan": "free",
    }


def _day_bucket_stats(group: list[Trade]) -> dict:
    ordered = sorted(group, key=lambda t: t.closed_at or t.opened_at)
    pnls = [float(t.pnl or 0) for t in ordered]
    fees = [float(t.fees or 0) for t in ordered]
    net = round(sum(pnls), 2)
    commissions = round(sum(fees), 2)
    running = 0.0
    curve = [0.0]
    for p in pnls:
        running = round(running + p, 2)
        curve.append(running)
    return {
        "trades": len(group),
        "pnl": net,
        "win_rate": win_rate(group),
        "gross_pnl": round(net + commissions, 2),
        "volume": round(sum(float(t.quantity or 0) for t in group), 4),
        "winners": sum(1 for p in pnls if p > 0),
        "losers": sum(1 for p in pnls if p < 0),
        "profit_factor": profit_factor(group),
        "commissions": commissions,
        "curve": curve,
    }


def calendar_days(
    db: Session,
    user_id: uuid.UUID,
    start: date,
    end: date,
    account_id: uuid.UUID | None = None,
) -> dict:
    since = datetime.combine(start, datetime.min.time()).replace(tzinfo=timezone.utc)
    trades = _closed_trades(db, user_id, since=since, account_id=account_id)
    trades = [t for t in trades if (t.closed_at or t.opened_at).date() <= end]

    buckets: dict[date, list[Trade]] = defaultdict(list)
    for t in trades:
        buckets[(t.closed_at or t.opened_at).date()].append(t)

    days = []
    for d in sorted(buckets):
        days.append({"date": d.isoformat(), **_day_bucket_stats(buckets[d])})

    return {
        "days": days,
        "total_pnl": round(sum(float(t.pnl or 0) for t in trades), 2),
        "total_trades": len(trades),
        "win_rate": win_rate(trades),
    }


def open_positions_summary(
    db: Session,
    user_id: uuid.UUID,
    account_id: uuid.UUID | None = None,
) -> list[dict]:
    open_trades = _open_trades(db, user_id, account_id=account_id)
    return [
        {
            "symbol": t.symbol,
            "side": t.side.value,
            "quantity": float(t.quantity),
            "entry_price": float(t.entry_price),
            "opened_at": t.opened_at.isoformat(),
            "setup_tag": t.setup_tag,
        }
        for t in open_trades
    ]


def recent_streak_info(db: Session, user_id: uuid.UUID, window: int = 5) -> dict:
    trades = _closed_trades(db, user_id)
    recent = trades[-window:]
    losses_in_a_row = 0
    for t in reversed(trades):
        if float(t.pnl or 0) < 0:
            losses_in_a_row += 1
        else:
            break
    return {
        "recent_trades": len(recent),
        "consecutive_losses": losses_in_a_row,
    }


def position_concentration(db: Session, user_id: uuid.UUID) -> list[dict]:
    open_trades = _open_trades(db, user_id)
    total_exposure = sum(float(t.quantity) * float(t.entry_price) for t in open_trades) or 1.0
    buckets: dict[str, float] = defaultdict(float)
    for t in open_trades:
        buckets[t.symbol] += float(t.quantity) * float(t.entry_price)
    return [
        {"symbol": symbol, "exposure": round(exposure, 2), "pct_of_book": round(exposure / total_exposure * 100, 1)}
        for symbol, exposure in sorted(buckets.items(), key=lambda x: x[1], reverse=True)
    ]


def journal_streak(db: Session, user_id: uuid.UUID, today: date | None = None) -> int:
    """Consecutive calendar days with a mood check-in, ending today or yesterday."""
    today = today or date.today()
    checkins = db.scalars(select(MoodCheckin).where(MoodCheckin.user_id == user_id)).all()
    dates = {c.date for c in checkins}
    if not dates:
        return 0

    start = today if today in dates else today - timedelta(days=1)
    if start not in dates:
        return 0

    streak = 0
    cursor = start
    while cursor in dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak
