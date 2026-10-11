"""Shared building blocks for advanced analytics.

Conventions (kept identical to stats_service / tradefix_score / dashboard_analytics):
- Universe: closed trades with non-null P&L, not deleted, owned by the user.
- Stored `pnl` is realized net of `fees`. `fees` already includes commission,
  swap, and funding on imports, so gross = pnl + fees and nothing else is added.
- Win: P&L > 0. Loss: P&L < 0. Breakeven: P&L == 0 (counts in win-rate denominator).
- R-multiple always uses stored net P&L / risk_amount (trade_scores.r_multiple).
- Hour / weekday buckets use local entry time; day / month buckets use the local
  realized date (close, else entry) in the user's timezone.
- Date filters match the frontend: local entry date in the user's timezone.
"""

from __future__ import annotations

import bisect
import math
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Any, Callable, Iterable, Sequence
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.services.masters_service import parse_label_list
from app.services.trade_scores import execution_score, health_score

PNL_MODES = ("net", "gross")
NO_STRATEGY = "__none__"
CLEAN = "__clean__"
SCORE_DIMENSIONS = (
    ("score_preparation", "Preparation"),
    ("score_risk", "Risk"),
    ("score_entry", "Entry"),
    ("score_exit", "Exit"),
    ("score_discipline", "Discipline"),
    ("score_psychology", "Psychology"),
)
WEEKDAY_NAMES = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
WEEKDAY_SHORT = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
MONTH_SHORT = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")

HOLD_BUCKETS: tuple[tuple[str, str, float], ...] = (
    ("lt1m", "< 1 min", 60),
    ("1to5m", "1–5 min", 300),
    ("5to15m", "5–15 min", 900),
    ("15to60m", "15–60 min", 3600),
    ("1to4h", "1–4 hours", 4 * 3600),
    ("4hto1d", "4h – 1 day", 86400),
    ("1to7d", "1–7 days", 7 * 86400),
    ("gt7d", "> 7 days", math.inf),
)

R_EDGES = (-3, -2, -1, -0.5, 0, 0.5, 1, 1.5, 2, 3, 5)
R_LABELS = ("<-3", "-3:-2", "-2:-1", "-1:-0.5", "-0.5:0", "0:0.5", "0.5:1", "1:1.5", "1.5:2", "2:3", "3:5", ">5")

COMPLIANCE_BUCKETS = (("0-4", "0–4", 0, 4), ("5-7", "5–7", 5, 7), ("8-9", "8–9", 8, 9), ("10", "10", 10, 10))
EXECUTION_BUCKETS = (("lt40", "< 40", 0, 39), ("40-59", "40–59", 40, 59), ("60-79", "60–79", 60, 79), ("80+", "80+", 80, 100))
TRADE_NUMBER_KEYS = ("1", "2", "3", "4", "5+")
QUICK_REENTRY_MINUTES = 15

MIN_GROUP = 5


def zone(name: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(name or "UTC")
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("UTC")


def as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def session_for_utc_hour(hour: int) -> str:
    """Same UTC approximation as stats_service._session_for_hour and the frontend."""
    if 0 <= hour < 7:
        return "Asia"
    if 7 <= hour < 12:
        return "London"
    if 12 <= hour < 16:
        return "Overlap"
    if 16 <= hour < 21:
        return "NY"
    return "Off"


def _num(value: Any) -> float | None:
    if value is None:
        return None
    try:
        out = float(value)
    except (TypeError, ValueError):
        return None
    return out if math.isfinite(out) else None


@dataclass(frozen=True)
class TradeView:
    """Immutable per-trade snapshot. `pnl` is in the selected P&L mode."""

    id: str
    symbol: str
    side: str
    asset_type: str
    opened_at: datetime
    closed_at: datetime | None
    local_open: datetime
    local_realized: datetime
    pnl: float
    net_pnl: float
    fees: float
    quantity: float | None
    entry_price: float | None
    exit_price: float | None
    stop_loss: float | None
    profit_target: float | None
    risk_amount: float | None
    r: float | None
    session: str
    strategy: str
    setups: tuple[str, ...]
    emotions: tuple[str, ...]
    rules: tuple[str, ...]
    moods: tuple[str, ...]
    plan_compliance: int | None
    scores: dict[str, int | None] = field(hash=False, compare=False)
    execution_score: int = 0
    health_score: float | None = None

    @property
    def open_date(self) -> date:
        return self.local_open.date()

    @property
    def realized_date(self) -> date:
        return self.local_realized.date()

    @property
    def realized_at(self) -> datetime:
        return self.closed_at or self.opened_at

    @property
    def outcome(self) -> str:
        if self.pnl > 0:
            return "win"
        if self.pnl < 0:
            return "loss"
        return "breakeven"

    @property
    def hold_seconds(self) -> float | None:
        if self.closed_at is None:
            return None
        seconds = (self.closed_at - self.opened_at).total_seconds()
        return seconds if seconds >= 0 else None


def _labels(value: Any) -> tuple[str, ...]:
    return tuple(parse_label_list(value))


def _moods(trade: Any) -> tuple[str, ...]:
    extra = getattr(trade, "extra", None) or {}
    stored = extra.get("moods") if isinstance(extra, dict) else None
    if stored:
        return _labels(stored)
    return _labels(getattr(trade, "mood", None))


def _setups(trade: Any) -> tuple[str, ...]:
    tags = list(parse_label_list(getattr(trade, "setup_tags", None) or []))
    primary = (getattr(trade, "setup_tag", None) or "").strip()
    if primary and primary.lower() not in {t.lower() for t in tags}:
        tags.append(primary)
    return tuple(tags)


def _enum_text(value: Any, default: str) -> str:
    raw = getattr(value, "value", value)
    text = str(raw or "").strip().lower()
    return text or default


def build_view(trade: Any, tz: ZoneInfo, pnl_mode: str) -> TradeView | None:
    """Returns None when the stored P&L is not a finite number."""
    net = _num(getattr(trade, "pnl", None))
    if net is None or getattr(trade, "opened_at", None) is None:
        return None
    fees = _num(getattr(trade, "fees", None)) or 0.0
    pnl = round(net + fees, 2) if pnl_mode == "gross" else net
    opened = as_utc(trade.opened_at)
    closed = as_utc(trade.closed_at) if getattr(trade, "closed_at", None) else None
    risk = _num(getattr(trade, "risk_amount", None))
    r = round(net / risk, 3) if risk not in (None, 0.0) else None
    session = (getattr(trade, "session", None) or "").strip() or session_for_utc_hour(opened.hour)
    strategy = (getattr(trade, "strategy_name", None) or "").strip() or NO_STRATEGY
    compliance = getattr(trade, "plan_compliance", None)
    scores = {attr: getattr(trade, attr, None) for attr, _ in SCORE_DIMENSIONS}
    return TradeView(
        id=str(getattr(trade, "id", "")),
        symbol=str(getattr(trade, "symbol", "") or "").strip().upper(),
        side=_enum_text(getattr(trade, "side", None), "long"),
        asset_type=_enum_text(getattr(trade, "asset_type", None), "stock"),
        opened_at=opened,
        closed_at=closed,
        local_open=opened.astimezone(tz),
        local_realized=(closed or opened).astimezone(tz),
        pnl=pnl,
        net_pnl=net,
        fees=fees,
        quantity=_num(getattr(trade, "quantity", None)),
        entry_price=_num(getattr(trade, "entry_price", None)),
        exit_price=_num(getattr(trade, "exit_price", None)),
        stop_loss=_num(getattr(trade, "stop_loss", None)),
        profit_target=_num(getattr(trade, "profit_target", None)),
        risk_amount=risk,
        r=r,
        session=session,
        strategy=strategy,
        setups=_setups(trade),
        emotions=_labels(getattr(trade, "emotion_tags", None) or []),
        rules=_labels(getattr(trade, "rules_broken", None) or []),
        moods=_moods(trade),
        plan_compliance=int(compliance) if compliance is not None else None,
        scores=scores,
        execution_score=execution_score(trade),
        health_score=health_score(trade),
    )


@dataclass
class Filters:
    date_from: date | None = None
    date_to: date | None = None
    symbols: list[str] = field(default_factory=list)
    sessions: list[str] = field(default_factory=list)
    setups: list[str] = field(default_factory=list)
    emotions: list[str] = field(default_factory=list)

    def normalized(self) -> "Filters":
        def clean(values: Iterable[str]) -> list[str]:
            out: list[str] = []
            for v in values:
                text = (v or "").strip()
                if text and text not in out:
                    out.append(text)
            return out

        return Filters(
            date_from=self.date_from,
            date_to=self.date_to,
            symbols=[s.upper() for s in clean(self.symbols)],
            sessions=clean(self.sessions),
            setups=clean(self.setups),
            emotions=clean(self.emotions),
        )


def matches(view: TradeView, f: Filters, *, date_from: date | None = None, date_to: date | None = None) -> bool:
    """AND across filters, OR within each multi-value filter. Dates default to the filter range."""
    lo = date_from if date_from is not None else f.date_from
    hi = date_to if date_to is not None else f.date_to
    if lo and view.open_date < lo:
        return False
    if hi and view.open_date > hi:
        return False
    if f.symbols and view.symbol not in f.symbols:
        return False
    if f.sessions and view.session not in f.sessions:
        return False
    if f.setups and not any(s in view.setups for s in f.setups):
        return False
    if f.emotions and not any(e in view.emotions or e in view.rules for e in f.emotions):
        return False
    return True


def previous_range(f: Filters) -> tuple[date, date] | None:
    """Equal-length window ending the day before date_from (local dates)."""
    if f.date_from is None or f.date_to is None or f.date_to < f.date_from:
        return None
    span = (f.date_to - f.date_from).days + 1
    prev_to = f.date_from - timedelta(days=1)
    return prev_to - timedelta(days=span - 1), prev_to


def realized_order(views: Sequence[TradeView]) -> list[TradeView]:
    return sorted(views, key=lambda v: (v.realized_at, v.opened_at, v.id))


def entry_order(views: Sequence[TradeView]) -> list[TradeView]:
    return sorted(views, key=lambda v: (v.opened_at, v.id))


def r2(value: float | None) -> float | None:
    return None if value is None else round(value, 2)


def stats(views: Sequence[TradeView]) -> dict[str, Any]:
    """Bucket stats with the same definitions as stats_service / dashboard_analytics."""
    n = len(views)
    wins = [v.pnl for v in views if v.pnl > 0]
    losses = [v.pnl for v in views if v.pnl < 0]
    gross_profit = sum(wins)
    gross_loss = abs(sum(losses))
    net = sum(v.pnl for v in views)
    avg_win = gross_profit / len(wins) if wins else None
    avg_loss = -(gross_loss / len(losses)) if losses else None
    return {
        "trades": n,
        "wins": len(wins),
        "losses": len(losses),
        "breakeven": n - len(wins) - len(losses),
        "win_rate": round(len(wins) / n * 100, 1) if n else None,
        "net_pnl": round(net, 2),
        "avg_pnl": round(net / n, 2) if n else None,
        "gross_profit": round(gross_profit, 2),
        "gross_loss": round(gross_loss, 2),
        "profit_factor": round(gross_profit / gross_loss, 2) if gross_loss > 0 else None,
        "avg_win": r2(avg_win),
        "avg_loss": r2(avg_loss),
        "payoff": round(avg_win / abs(avg_loss), 2) if avg_win is not None and avg_loss else None,
    }


def mean(values: Sequence[float]) -> float | None:
    return sum(values) / len(values) if values else None


def sample_stdev(values: Sequence[float]) -> float | None:
    if len(values) < 2:
        return None
    m = sum(values) / len(values)
    return math.sqrt(sum((x - m) ** 2 for x in values) / (len(values) - 1))


def compare_groups(with_values: Sequence[float], without_values: Sequence[float]) -> dict[str, Any]:
    """Welch comparison of mean P&L. Evidence tiers: t >= 2 strong, >= 1 moderate, else weak.

    Requires MIN_GROUP trades on each side; otherwise evidence is "insufficient".
    This measures association in the recorded history, never causation.
    """
    n1, n2 = len(with_values), len(without_values)
    m1, m2 = mean(with_values), mean(without_values)
    out: dict[str, Any] = {
        "n_with": n1,
        "n_without": n2,
        "avg_with": r2(m1),
        "avg_without": r2(m2),
        "diff": r2(m1 - m2) if m1 is not None and m2 is not None else None,
        "t_stat": None,
        "evidence": "insufficient",
    }
    if n1 < MIN_GROUP or n2 < MIN_GROUP or m1 is None or m2 is None:
        return out
    s1, s2 = sample_stdev(with_values) or 0.0, sample_stdev(without_values) or 0.0
    se = math.sqrt(s1 * s1 / n1 + s2 * s2 / n2)
    diff = m1 - m2
    if se <= 1e-12:
        t = math.inf if abs(diff) > 1e-9 else 0.0
    else:
        t = abs(diff) / se
    out["t_stat"] = round(t, 2) if math.isfinite(t) else None
    out["evidence"] = "strong" if t >= 2 else "moderate" if t >= 1 else "weak"
    return out


def hold_bucket(seconds: float | None) -> str | None:
    if seconds is None:
        return None
    for key, _, upper in HOLD_BUCKETS:
        if seconds < upper:
            return key
    return HOLD_BUCKETS[-1][0]


def r_bucket(r: float | None) -> str | None:
    if r is None:
        return None
    for i, edge in enumerate(R_EDGES):
        if r < edge:
            return R_LABELS[i]
    return R_LABELS[-1]


def range_bucket(value: int | None, buckets: Sequence[tuple[str, str, int, int]]) -> str | None:
    if value is None:
        return None
    for key, _, lo, hi in buckets:
        if lo <= value <= hi:
            return key
    return None


@dataclass
class Context:
    """Per-trade derived facts computed once and shared by aggregation and drill-down."""

    trade_number: dict[str, str] = field(default_factory=dict)
    after: dict[str, str] = field(default_factory=dict)
    quick_reentry: set[str] = field(default_factory=set)
    checkin: dict[date, str] = field(default_factory=dict)
    mood_score: dict[date, int] = field(default_factory=dict)
    duplicates: set[str] = field(default_factory=set)


def duplicate_key(view: TradeView) -> tuple:
    return (
        view.symbol,
        view.side,
        view.opened_at,
        view.closed_at,
        view.quantity,
        view.entry_price,
        view.exit_price,
        round(view.net_pnl, 2),
    )


def build_context(
    views: Sequence[TradeView],
    *,
    checkins: dict[date, str] | None = None,
    mood_scores: dict[date, int] | None = None,
) -> Context:
    ctx = Context(checkin=dict(checkins or {}), mood_score=dict(mood_scores or {}))

    per_day: dict[date, list[TradeView]] = defaultdict(list)
    for v in entry_order(views):
        per_day[v.open_date].append(v)
    for day_views in per_day.values():
        for i, v in enumerate(day_views):
            ctx.trade_number[v.id] = TRADE_NUMBER_KEYS[min(i, len(TRADE_NUMBER_KEYS) - 1)]

    # Previous trade = most recent trade whose exit was already known when this one was entered.
    by_close = realized_order(views)
    closes = [v.realized_at for v in by_close]
    for v in views:
        idx = bisect.bisect_right(closes, v.opened_at) - 1
        while idx >= 0 and by_close[idx].id == v.id:
            idx -= 1
        if idx < 0:
            ctx.after[v.id] = "first"
            continue
        prev = by_close[idx]
        ctx.after[v.id] = f"after_{prev.outcome}"
        if prev.outcome == "loss":
            gap = (v.opened_at - prev.realized_at).total_seconds()
            if 0 <= gap <= QUICK_REENTRY_MINUTES * 60:
                ctx.quick_reentry.add(v.id)

    groups: dict[tuple, list[str]] = defaultdict(list)
    for v in views:
        groups[duplicate_key(v)].append(v.id)
    for ids in groups.values():
        if len(ids) > 1:
            ctx.duplicates.update(ids)
    return ctx


KeyFn = Callable[[TradeView, Context], Iterable[str]]


def _one(value: str | None) -> list[str]:
    return [value] if value else []


DIMENSIONS: dict[str, KeyFn] = {
    "all": lambda v, c: ["all"],
    "outcome": lambda v, c: [v.outcome],
    "weekday_hour": lambda v, c: [f"{v.local_open.weekday()}-{v.local_open.hour}"],
    "weekday": lambda v, c: [str(v.local_open.weekday())],
    "hour": lambda v, c: [str(v.local_open.hour)],
    "session": lambda v, c: [v.session],
    "hold": lambda v, c: _one(hold_bucket(v.hold_seconds)),
    "month": lambda v, c: [v.local_realized.strftime("%Y-%m")],
    "day": lambda v, c: [v.realized_date.isoformat()],
    "symbol": lambda v, c: _one(v.symbol),
    "side": lambda v, c: [v.side],
    "asset_type": lambda v, c: [v.asset_type],
    "strategy": lambda v, c: [v.strategy],
    "setup": lambda v, c: list(v.setups),
    "emotion": lambda v, c: list(v.emotions),
    "rule": lambda v, c: list(v.rules) or [CLEAN],
    "mood": lambda v, c: list(v.moods),
    "mood_score": lambda v, c: _one(str(c.mood_score[v.open_date]) if v.open_date in c.mood_score else None),
    "compliance": lambda v, c: _one(range_bucket(v.plan_compliance, COMPLIANCE_BUCKETS)),
    "execution": lambda v, c: _one(range_bucket(v.execution_score, EXECUTION_BUCKETS)),
    "trade_number": lambda v, c: _one(c.trade_number.get(v.id)),
    "after": lambda v, c: _one(c.after.get(v.id)),
    "quick_reentry": lambda v, c: ["yes"] if v.id in c.quick_reentry else ["no"],
    "r_bucket": lambda v, c: _one(r_bucket(v.r)),
    "checkin": lambda v, c: [c.checkin.get(v.realized_date, "none")],
    "duplicate": lambda v, c: ["yes"] if v.id in c.duplicates else [],
}


def keys_for(dimension: str, view: TradeView, ctx: Context) -> list[str]:
    return list(DIMENSIONS[dimension](view, ctx))


def group_by(dimension: str, views: Sequence[TradeView], ctx: Context) -> dict[str, list[TradeView]]:
    out: dict[str, list[TradeView]] = defaultdict(list)
    for v in views:
        for key in keys_for(dimension, v, ctx):
            out[key].append(v)
    return out


def downsample(items: Sequence[Any], limit: int, keep: Iterable[int] = ()) -> list[Any]:
    """Even sampling that always keeps the first, last, and any `keep` indices."""
    n = len(items)
    if n <= limit:
        return list(items)
    picked = {0, n - 1, *[i for i in keep if 0 <= i < n]}
    step = (n - 1) / (limit - 1)
    picked.update(round(i * step) for i in range(limit))
    return [items[i] for i in sorted(picked)]
