"""Advanced analytics: one loader + pure modules, shared by the insights endpoint and drill-down.

Aggregates and drill-down run the same pipeline (load -> filter -> context ->
dimension registry), so a drill-down for any bucket returns exactly the trades
that were counted in it.
"""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass
from datetime import date, datetime, time as dtime, timedelta, timezone
from types import SimpleNamespace
from typing import Any, Sequence

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.daily_checkin import DailyCheckin
from app.models.mood import MoodCheckin
from app.models.trade import Trade, TradeStatus
from app.models.user import User
from app.services.advanced_analytics import (
    discipline,
    insights,
    montecarlo,
    performance,
    psychology,
    risk,
    strategy,
    timing,
)
from app.services.advanced_analytics.core import (
    DIMENSIONS,
    Context,
    Filters,
    TradeView,
    build_context,
    build_view,
    keys_for,
    matches,
    previous_range,
    stats,
    zone,
)
from app.services.live_trades import live_scope, live_trades
from app.services.tradefix_score import calculate_tradefix_score

logger = logging.getLogger(__name__)

DRILL_LIMIT = 200
MIN_SCORE_TRADES = 5
PNL_NOTE = (
    "Net P&L is the stored realized P&L after fees, commission, swap and funding. "
    "Gross P&L adds those costs back once. R-multiples and the TradeFix Score always use net P&L."
)
EQUITY_NOTE = (
    "Realized equity = starting balance + cumulative closed-trade P&L. "
    "Deposits, withdrawals and open positions are not included."
)
SCOPE_NOTE = (
    "Trade order facts (trade number of the day, previous result, quick re-entry, duplicates) "
    "use every trade in the date range on this account, before symbol/session/tag filters."
)


class AccountNotFound(LookupError):
    pass


@dataclass
class Loaded:
    account: Account
    tz_name: str
    filters: Filters
    pnl_mode: str
    current: list[TradeView]
    previous: list[TradeView] | None
    previous_range: tuple[date, date] | None
    ctx: Context
    skipped_invalid: int
    open_trades: int


def _local_midnight_utc(day: date, tz) -> datetime:
    return datetime.combine(day, dtime.min, tzinfo=tz).astimezone(timezone.utc)


def load(
    db: Session,
    user: User,
    account_id: uuid.UUID,
    filters: Filters,
    pnl_mode: str,
) -> Loaded:
    account = db.scalar(select(Account).where(Account.id == account_id, Account.user_id == user.id))
    if account is None:
        raise AccountNotFound(str(account_id))
    tz_name = user.timezone or "UTC"
    tz = zone(tz_name)
    f = filters.normalized()
    prev = previous_range(f)
    lower = prev[0] if prev else f.date_from
    upper = f.date_to

    stmt = live_trades(user.id).where(
        Trade.account_id == account.id,
        Trade.status == TradeStatus.closed,
        Trade.pnl.is_not(None),
    )
    if lower:
        stmt = stmt.where(Trade.opened_at >= _local_midnight_utc(lower, tz))
    if upper:
        stmt = stmt.where(Trade.opened_at < _local_midnight_utc(upper + timedelta(days=1), tz))
    stmt = stmt.order_by(Trade.opened_at.asc(), Trade.id.asc())
    rows = db.scalars(stmt).all()

    views: list[TradeView] = []
    skipped = 0
    for row in rows:
        view = build_view(row, tz, pnl_mode)
        if view is None:
            skipped += 1
        else:
            views.append(view)

    window = [v for v in views if matches(v, Filters(date_from=f.date_from, date_to=f.date_to))]
    current = [v for v in window if matches(v, f)]
    previous = [v for v in views if matches(v, f, date_from=prev[0], date_to=prev[1])] if prev else None

    checkins: dict[date, str] = {}
    moods: dict[date, int] = {}
    if window:
        lo = min(v.realized_date for v in window)
        hi = max(v.realized_date for v in window)
        for c in db.scalars(
            select(DailyCheckin).where(
                DailyCheckin.user_id == user.id,
                or_(DailyCheckin.account_id.is_(None), DailyCheckin.account_id == account.id),
                DailyCheckin.date >= lo,
                DailyCheckin.date <= hi,
            )
        ).all():
            if c.followed in ("yes", "partial", "no"):
                checkins[c.date] = c.followed
        open_lo = min(v.open_date for v in window)
        open_hi = max(v.open_date for v in window)
        for m in db.scalars(
            select(MoodCheckin).where(
                MoodCheckin.user_id == user.id,
                MoodCheckin.date >= open_lo,
                MoodCheckin.date <= open_hi,
            )
        ).all():
            moods[m.date] = int(m.mood_score)

    open_count = int(
        db.scalar(
            select(func.count())
            .select_from(Trade)
            .where(
                *live_scope(user.id),
                Trade.account_id == account.id,
                Trade.status == TradeStatus.open,
            )
        )
        or 0
    )
    ctx = build_context(window, checkins=checkins, mood_scores=moods)
    return Loaded(
        account=account,
        tz_name=str(tz),
        filters=f,
        pnl_mode=pnl_mode,
        current=current,
        previous=previous,
        previous_range=prev,
        ctx=ctx,
        skipped_invalid=skipped,
        open_trades=open_count,
    )


def period_label(f: Filters) -> str:
    def fmt(d: date) -> str:
        return d.strftime("%b %d, %Y").replace(" 0", " ")

    if f.date_from and f.date_to:
        return fmt(f.date_from) if f.date_from == f.date_to else f"{fmt(f.date_from)} – {fmt(f.date_to)}"
    if f.date_from:
        return f"since {fmt(f.date_from)}"
    if f.date_to:
        return f"until {fmt(f.date_to)}"
    return "all time"


def _net(views: Sequence[TradeView]) -> list[SimpleNamespace]:
    return [SimpleNamespace(pnl=v.net_pnl, closed_at=v.closed_at, opened_at=v.opened_at) for v in views]


def data_quality(loaded: Loaded) -> dict[str, Any]:
    views = loaded.current
    dup_ids = [v.id for v in views if v.id in loaded.ctx.duplicates]
    return {
        "skipped_invalid_pnl": loaded.skipped_invalid,
        "missing_risk": sum(1 for v in views if v.r is None),
        "missing_close_time": sum(1 for v in views if v.closed_at is None),
        "unrated": sum(1 for v in views if all(s is None for s in v.scores.values())),
        "possible_duplicates": len(dup_ids),
        "duplicate_note": (
            "Trades with identical symbol, side, entry/exit time, quantity, prices and P&L. "
            "They are still included in every calculation — review them in the trade list."
        ),
    }


def build_advanced(
    db: Session,
    user: User,
    account_id: uuid.UUID,
    filters: Filters,
    *,
    pnl_mode: str = "net",
    seed: int = montecarlo.DEFAULT_SEED,
) -> dict[str, Any]:
    started = time.perf_counter()
    loaded = load(db, user, account_id, filters, pnl_mode)
    views, ctx = loaded.current, loaded.ctx
    balance = float(loaded.account.initial_balance or 0)
    period = period_label(loaded.filters)

    summary = performance.kpis(views, balance)
    prev_summary = performance.kpis(loaded.previous, balance) if loaded.previous is not None else None

    prev_score = None
    if loaded.previous is not None and len(loaded.previous) >= MIN_SCORE_TRADES and len(views) >= MIN_SCORE_TRADES:
        prev_result = calculate_tradefix_score(_net(loaded.previous), starting_equity=balance)
        prev_score = prev_result.get("overall_score")
    score = calculate_tradefix_score(_net(views), starting_equity=balance, previous_score=prev_score)

    result = {
        "meta": {
            "account_id": str(loaded.account.id),
            "currency": loaded.account.base_currency,
            "timezone": loaded.tz_name,
            "pnl_mode": pnl_mode,
            "date_from": loaded.filters.date_from.isoformat() if loaded.filters.date_from else None,
            "date_to": loaded.filters.date_to.isoformat() if loaded.filters.date_to else None,
            "period_label": period,
            "previous_from": loaded.previous_range[0].isoformat() if loaded.previous_range else None,
            "previous_to": loaded.previous_range[1].isoformat() if loaded.previous_range else None,
            "filters": {
                "symbols": loaded.filters.symbols,
                "sessions": loaded.filters.sessions,
                "setups": loaded.filters.setups,
                "emotions": loaded.filters.emotions,
            },
            "trade_count": len(views),
            "open_trades_excluded": loaded.open_trades,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "pnl_note": PNL_NOTE,
            "equity_note": EQUITY_NOTE,
            "scope_note": SCOPE_NOTE,
        },
        "data_quality": data_quality(loaded),
        "summary": summary,
        "comparison": performance.comparison(summary, prev_summary),
        "score": score,
        "performance": {
            "equity": performance.equity(views, balance),
            "monthly": performance.monthly(views, balance),
            "daily": performance.daily_distribution(views),
        },
        "risk": {
            "r": risk.r_stats(views),
            "sqn": risk.sqn(views),
            "kelly": risk.kelly(views),
            "plan": risk.plan_vs_outcome(views),
            "streaks": risk.streaks(views),
            "monte_carlo": montecarlo.simulate(
                [v.pnl for v in sorted(views, key=lambda v: (v.realized_at, v.opened_at, v.id))],
                starting_balance=balance,
                seed=seed,
            ),
        },
        "timing": timing.build(views, ctx),
        "strategy": strategy.build(views, ctx),
        "psychology": psychology.build(views, ctx),
        "discipline": discipline.build(views, ctx, loaded.previous),
        "insights": insights.build(views, ctx, period),
    }
    logger.info(
        "advanced_analytics user=%s account=%s trades=%d mode=%s ms=%.1f",
        user.id,
        loaded.account.id,
        len(views),
        pnl_mode,
        (time.perf_counter() - started) * 1000,
    )
    return result


def drilldown(
    db: Session,
    user: User,
    account_id: uuid.UUID,
    filters: Filters,
    *,
    dimension: str,
    key: str,
    pnl_mode: str = "net",
    limit: int = DRILL_LIMIT,
) -> dict[str, Any]:
    if dimension not in DIMENSIONS:
        raise ValueError(f"Unknown dimension: {dimension}")
    loaded = load(db, user, account_id, filters, pnl_mode)
    matched = [v for v in loaded.current if key in keys_for(dimension, v, loaded.ctx)]
    matched.sort(key=lambda v: (v.opened_at, v.id), reverse=True)
    shown = matched[: max(1, min(limit, DRILL_LIMIT))]
    return {
        "dimension": dimension,
        "key": key,
        "pnl_mode": pnl_mode,
        "total": len(matched),
        "returned": len(shown),
        "truncated": len(shown) < len(matched),
        "summary": stats(matched),
        "rows": [
            {
                "id": v.id,
                "symbol": v.symbol,
                "side": v.side,
                "opened_at": v.opened_at.isoformat(),
                "closed_at": v.closed_at.isoformat() if v.closed_at else None,
                "pnl": round(v.pnl, 2),
                "net_pnl": round(v.net_pnl, 2),
                "fees": round(v.fees, 2),
                "r": v.r,
                "strategy": None if v.strategy == "__none__" else v.strategy,
                "setups": list(v.setups),
                "emotions": list(v.emotions),
                "rules": list(v.rules),
                "possible_duplicate": v.id in loaded.ctx.duplicates,
            }
            for v in shown
        ],
    }
