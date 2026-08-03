"""Deterministic number-crunching used by analytics endpoints, the rule-based
insight engine, and every AI agent. Nothing in here calls an LLM — agents only
ever receive the *output* of these functions so they can never invent a stat.
"""

import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.mood import MoodCheckin
from app.models.trade import Trade, TradeStatus


def _closed_trades(db: Session, user_id: uuid.UUID, since: datetime | None = None) -> list[Trade]:
    stmt = select(Trade).where(Trade.user_id == user_id, Trade.status == TradeStatus.closed, Trade.pnl.is_not(None))
    if since:
        stmt = stmt.where(Trade.opened_at >= since)
    stmt = stmt.order_by(Trade.opened_at.asc())
    return list(db.scalars(stmt).all())


def _open_trades(db: Session, user_id: uuid.UUID) -> list[Trade]:
    stmt = select(Trade).where(Trade.user_id == user_id, Trade.status == TradeStatus.open)
    return list(db.scalars(stmt).all())


def win_rate(trades: list[Trade]) -> float:
    if not trades:
        return 0.0
    wins = sum(1 for t in trades if float(t.pnl or 0) > 0)
    return round(wins / len(trades) * 100, 1)


def overview_stats(db: Session, user_id: uuid.UUID) -> dict:
    trades = _closed_trades(db, user_id)
    if not trades:
        return {
            "total_trades": 0,
            "win_rate": 0.0,
            "total_pnl": 0.0,
            "avg_win": 0.0,
            "avg_loss": 0.0,
            "current_streak": 0,
            "current_streak_type": "none",
            "best_day_pnl": 0.0,
            "worst_day_pnl": 0.0,
        }

    wins = [float(t.pnl) for t in trades if float(t.pnl) > 0]
    losses = [float(t.pnl) for t in trades if float(t.pnl) < 0]
    total_pnl = round(sum(float(t.pnl) for t in trades), 2)

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

    return {
        "total_trades": len(trades),
        "win_rate": win_rate(trades),
        "total_pnl": total_pnl,
        "avg_win": round(sum(wins) / len(wins), 2) if wins else 0.0,
        "avg_loss": round(sum(losses) / len(losses), 2) if losses else 0.0,
        "current_streak": streak,
        "current_streak_type": streak_type,
        "best_day_pnl": round(best_day, 2),
        "worst_day_pnl": round(worst_day, 2),
    }


def daily_pnl_map(trades: list[Trade]) -> dict[date, float]:
    out: dict[date, float] = defaultdict(float)
    for t in trades:
        d = t.opened_at.date()
        out[d] += float(t.pnl or 0)
    return dict(out)


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
    now = datetime.now(tz=trades[0].opened_at.tzinfo) if trades else datetime.utcnow()
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


def full_analytics(db: Session, user_id: uuid.UUID) -> dict:
    trades = _closed_trades(db, user_id)
    return {
        "overview": overview_stats(db, user_id),
        "by_hour": by_hour_stats(trades),
        "by_day_of_week": by_day_of_week_stats(trades),
        "by_setup": by_setup_stats(trades),
        "mood_vs_pnl": mood_vs_pnl_stats(db, user_id, trades),
    }


def calendar_days(db: Session, user_id: uuid.UUID, start: date, end: date) -> dict:
    trades = _closed_trades(db, user_id, since=datetime.combine(start, datetime.min.time()))
    trades = [t for t in trades if t.opened_at.date() <= end]

    buckets: dict[date, list[Trade]] = defaultdict(list)
    for t in trades:
        buckets[t.opened_at.date()].append(t)

    days = []
    for d in sorted(buckets):
        group = buckets[d]
        days.append({
            "date": d.isoformat(),
            "trades": len(group),
            "pnl": round(sum(float(t.pnl or 0) for t in group), 2),
            "win_rate": win_rate(group),
        })

    return {
        "days": days,
        "total_pnl": round(sum(float(t.pnl or 0) for t in trades), 2),
        "total_trades": len(trades),
        "win_rate": win_rate(trades),
    }


def open_positions_summary(db: Session, user_id: uuid.UUID) -> list[dict]:
    open_trades = _open_trades(db, user_id)
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
