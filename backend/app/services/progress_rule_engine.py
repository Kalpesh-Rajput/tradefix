"""Pure Progress Tracker rule evaluators.

Evaluators take plain snapshots so they can be unit-tested without a database.
Adding a future rule means implementing `evaluate_*` and registering it in
`builtin_evaluators()`.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, time
from typing import Any, Callable, Literal
from uuid import UUID

from app.services.progress_time import (
    is_active_day,
    local_date,
    local_time,
    resolve_timezone,
    time_in_window,
    weekday_key,
)

RuleStatus = Literal["passed", "failed", "pending", "not_applicable"]
RuleKind = Literal["builtin", "manual"]


@dataclass(frozen=True)
class TradeSnapshot:
    opened_at: datetime
    closed_at: datetime | None
    pnl: float | None
    stop_loss: float | None
    playbook_id: UUID | None
    account_id: UUID
    account_balance: float
    status: str
    is_deleted: bool = False


@dataclass(frozen=True)
class ManualRuleSnapshot:
    id: UUID
    name: str
    schedule: tuple[str, ...]
    sort_order: int
    is_active: bool


@dataclass(frozen=True)
class ConfigSnapshot:
    active_days: tuple[str, ...]
    reminder_enabled: bool = False
    reminder_time: str = "20:15"
    trading_hours_enabled: bool = False
    trading_start_time: str = "09:30"
    trading_end_time: str = "16:00"
    start_day_enabled: bool = False
    start_day_time: str = "09:00"
    link_playbook_enabled: bool = False
    stop_loss_required: bool = False
    max_loss_per_trade_enabled: bool = False
    max_loss_per_trade_mode: str = "amount"
    max_loss_per_trade_value: float = 0.0
    max_loss_per_day_enabled: bool = False
    max_loss_per_day_value: float = 0.0
    manual_rules: tuple[ManualRuleSnapshot, ...] = ()


@dataclass
class RuleResult:
    rule_key: str
    name: str
    kind: RuleKind
    status: RuleStatus
    condition: str | None = None
    detail: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    rule_id: UUID | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "rule_key": self.rule_key,
            "rule_id": str(self.rule_id) if self.rule_id else None,
            "name": self.name,
            "kind": self.kind,
            "status": self.status,
            "condition": self.condition,
            "detail": self.detail,
            "metadata": self.metadata,
        }


@dataclass
class DailyEvaluation:
    date: date
    is_trading_day: bool
    participated: bool
    started_at: datetime | None
    tracking: bool
    results: list[RuleResult]
    passed: int
    failed: int
    pending: int
    not_applicable: int
    total_rules: int
    score: float | None

    def to_dict(self) -> dict[str, Any]:
        return {
            "date": self.date.isoformat(),
            "is_trading_day": self.is_trading_day,
            "participated": self.participated,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "tracking": self.tracking,
            "passed": self.passed,
            "failed": self.failed,
            "pending": self.pending,
            "not_applicable": self.not_applicable,
            "total_rules": self.total_rules,
            "score": self.score,
            "results": [r.to_dict() for r in self.results],
        }


def net_pnl(trade: TradeSnapshot) -> float | None:
    if trade.pnl is None:
        return None
    return float(trade.pnl)


def format_hhmm(value: str) -> str:
    return value


def _count(results: list[RuleResult], status: RuleStatus) -> int:
    return sum(1 for r in results if r.status == status)


def _score(passed: int, failed: int, pending: int) -> float | None:
    applicable = passed + failed + pending
    if applicable <= 0:
        return None
    return round(100.0 * passed / applicable, 2)


def trades_for_day(trades: list[TradeSnapshot], day: date, tz_name: str) -> list[TradeSnapshot]:
    tz = resolve_timezone(tz_name)
    out: list[TradeSnapshot] = []
    for trade in trades:
        if trade.is_deleted:
            continue
        stamp = trade.closed_at or trade.opened_at
        if local_date(stamp, tz) == day:
            out.append(trade)
    return out


def evaluate_trading_hours(
    config: ConfigSnapshot,
    trades: list[TradeSnapshot],
    tz_name: str,
) -> RuleResult:
    condition = f"{config.trading_start_time} / {config.trading_end_time}"
    tz = resolve_timezone(tz_name)
    if not trades:
        return RuleResult(
            rule_key="trading_hours",
            name="Trading hours",
            kind="builtin",
            status="not_applicable",
            condition=condition,
            detail="No trades on this day",
            metadata={"trade_count": 0, "violations": 0},
        )
    violations = 0
    for trade in trades:
        local = local_time(trade.opened_at, tz)
        if not time_in_window(local, config.trading_start_time, config.trading_end_time):
            violations += 1
    status: RuleStatus = "passed" if violations == 0 else "failed"
    return RuleResult(
        rule_key="trading_hours",
        name="Trading hours",
        kind="builtin",
        status=status,
        condition=condition,
        detail=(
            "All trades opened inside the window"
            if violations == 0
            else f"{violations} trade(s) opened outside the window"
        ),
        metadata={
            "trade_count": len(trades),
            "violations": violations,
            "compliance_ratio": round((len(trades) - violations) / len(trades), 4) if trades else None,
        },
    )


def evaluate_start_day(
    config: ConfigSnapshot,
    started_at: datetime | None,
    day: date,
    today: date,
    tz_name: str,
) -> RuleResult:
    condition = format_hhmm(config.start_day_time)
    if started_at is None:
        status: RuleStatus = "pending" if day >= today else "failed"
        return RuleResult(
            rule_key="start_day",
            name="Start my day by",
            kind="builtin",
            status=status,
            condition=condition,
            detail="Day has not been started" if status == "pending" else "Day was not started",
            metadata={"started": False},
        )
    tz = resolve_timezone(tz_name)
    started_local = local_time(started_at, tz)
    deadline = time(*[int(p) for p in config.start_day_time.split(":")])
    on_time = (started_local.hour, started_local.minute) <= (deadline.hour, deadline.minute)
    return RuleResult(
        rule_key="start_day",
        name="Start my day by",
        kind="builtin",
        status="passed" if on_time else "failed",
        condition=condition,
        detail=(
            f"Started at {started_local.strftime('%H:%M')}"
            if on_time
            else f"Started late at {started_local.strftime('%H:%M')}"
        ),
        metadata={
            "started": True,
            "started_at": started_at.isoformat(),
            "started_local": started_local.strftime("%H:%M"),
            "on_time": on_time,
        },
    )


def evaluate_playbook(trades: list[TradeSnapshot]) -> RuleResult:
    if not trades:
        return RuleResult(
            rule_key="link_playbook",
            name="Link trades to playbook",
            kind="builtin",
            status="not_applicable",
            condition="Playbook required",
            detail="No trades on this day",
            metadata={"trade_count": 0, "linked": 0, "missing": 0},
        )
    missing = sum(1 for t in trades if t.playbook_id is None)
    linked = len(trades) - missing
    return RuleResult(
        rule_key="link_playbook",
        name="Link trades to playbook",
        kind="builtin",
        status="passed" if missing == 0 else "failed",
        condition="Playbook required",
        detail="All trades have a playbook" if missing == 0 else f"{missing} trade(s) missing a playbook",
        metadata={
            "trade_count": len(trades),
            "linked": linked,
            "missing": missing,
            "ratio": round(linked / len(trades), 4),
        },
    )


def evaluate_stop_loss(trades: list[TradeSnapshot]) -> RuleResult:
    if not trades:
        return RuleResult(
            rule_key="stop_loss",
            name="Input stop loss to all trades",
            kind="builtin",
            status="not_applicable",
            condition="Stop loss required",
            detail="No trades on this day",
            metadata={"trade_count": 0, "with_stop": 0, "missing": 0},
        )
    missing = sum(1 for t in trades if t.stop_loss is None)
    with_stop = len(trades) - missing
    return RuleResult(
        rule_key="stop_loss",
        name="Input stop loss to all trades",
        kind="builtin",
        status="passed" if missing == 0 else "failed",
        condition="Stop loss required",
        detail="All trades have a stop loss" if missing == 0 else f"{missing} trade(s) missing a stop loss",
        metadata={
            "trade_count": len(trades),
            "with_stop": with_stop,
            "missing": missing,
            "ratio": round(with_stop / len(trades), 4),
        },
    )


def _trade_loss_threshold(trade: TradeSnapshot, mode: str, value: float) -> float | None:
    if value <= 0:
        return None
    if mode == "percent":
        balance = float(trade.account_balance or 0)
        if balance <= 0:
            return None
        return balance * (value / 100.0)
    return value


def evaluate_max_loss_per_trade(config: ConfigSnapshot, trades: list[TradeSnapshot]) -> RuleResult:
    mode = config.max_loss_per_trade_mode if config.max_loss_per_trade_mode in ("amount", "percent") else "amount"
    value = float(config.max_loss_per_trade_value or 0)
    condition = f"{value:.2f}%" if mode == "percent" else f"{value:.2f}"
    closed = [t for t in trades if t.status == "closed" and t.pnl is not None]
    if not closed:
        return RuleResult(
            rule_key="max_loss_per_trade",
            name="Net max loss / trade",
            kind="builtin",
            status="not_applicable",
            condition=condition,
            detail="No closed trades on this day",
            metadata={"trade_count": 0, "violations": 0, "worst_loss": 0},
        )
    violations = 0
    worst = 0.0
    observed: list[float] = []
    for trade in closed:
        pnl = float(trade.pnl or 0)
        if pnl >= 0:
            continue
        loss = abs(pnl)
        observed.append(loss)
        worst = max(worst, loss)
        threshold = _trade_loss_threshold(trade, mode, value)
        if threshold is not None and loss > threshold + 1e-9:
            violations += 1
    return RuleResult(
        rule_key="max_loss_per_trade",
        name="Net max loss / trade",
        kind="builtin",
        status="passed" if violations == 0 else "failed",
        condition=condition,
        detail="All trades stayed within the loss cap" if violations == 0 else f"{violations} trade(s) exceeded the cap",
        metadata={
            "trade_count": len(closed),
            "violations": violations,
            "worst_loss": round(worst, 2),
            "avg_loss": round(sum(observed) / len(observed), 2) if observed else 0,
            "threshold": value,
            "mode": mode,
        },
    )


def evaluate_max_loss_per_day(config: ConfigSnapshot, trades: list[TradeSnapshot]) -> RuleResult:
    threshold = float(config.max_loss_per_day_value or 0)
    condition = f"{threshold:.2f}"
    closed = [t for t in trades if t.status == "closed" and t.pnl is not None]
    if not closed:
        return RuleResult(
            rule_key="max_loss_per_day",
            name="Net max loss / day",
            kind="builtin",
            status="not_applicable",
            condition=condition,
            detail="No closed trades on this day",
            metadata={"trade_count": 0, "net_pnl": 0, "violations": 0},
        )
    total = round(sum(float(t.pnl or 0) for t in closed), 2)
    exceeded = total < 0 and abs(total) > threshold + 1e-9
    return RuleResult(
        rule_key="max_loss_per_day",
        name="Net max loss / day",
        kind="builtin",
        status="failed" if exceeded else "passed",
        condition=condition,
        detail=f"Day net P&L {total:.2f}" if not exceeded else f"Day net loss {total:.2f} exceeded {threshold:.2f}",
        metadata={
            "trade_count": len(closed),
            "net_pnl": total,
            "violations": 1 if exceeded else 0,
            "threshold": threshold,
        },
    )


def evaluate_manual_rule(
    rule: ManualRuleSnapshot,
    day: date,
    today: date,
    completed: bool,
) -> RuleResult:
    key = weekday_key(day)
    condition = _schedule_label(rule.schedule)
    if key not in {d.lower()[:3] for d in rule.schedule}:
        return RuleResult(
            rule_key=f"manual:{rule.id}",
            rule_id=rule.id,
            name=rule.name,
            kind="manual",
            status="not_applicable",
            condition=condition,
            detail="Not scheduled for this day",
            metadata={"completed": False},
        )
    if completed:
        status: RuleStatus = "passed"
        detail = "Completed"
    elif day > today:
        status = "not_applicable"
        detail = "Scheduled for a future day"
    elif day == today:
        status = "pending"
        detail = "Not completed yet"
    else:
        status = "failed"
        detail = "Not completed"
    return RuleResult(
        rule_key=f"manual:{rule.id}",
        rule_id=rule.id,
        name=rule.name,
        kind="manual",
        status=status,
        condition=condition,
        detail=detail,
        metadata={"completed": completed},
    )


def _schedule_label(schedule: tuple[str, ...] | list[str]) -> str:
    days = [str(d).lower()[:3] for d in schedule]
    ordered = [d for d in ("mon", "tue", "wed", "thu", "fri", "sat", "sun") if d in days]
    if ordered == list(("mon", "tue", "wed", "thu", "fri", "sat", "sun")):
        return "All"
    if ordered == ["mon", "tue", "wed", "thu", "fri"]:
        return "Mon-Fri"
    labels = {"mon": "Mon", "tue": "Tue", "wed": "Wed", "thu": "Thu", "fri": "Fri", "sat": "Sat", "sun": "Sun"}
    return ", ".join(labels[d] for d in ordered) or "—"


def builtin_condition(config: ConfigSnapshot, key: str) -> str:
    if key == "trading_hours":
        return f"{config.trading_start_time} / {config.trading_end_time}"
    if key == "start_day":
        return config.start_day_time
    if key == "link_playbook":
        return "Playbook required"
    if key == "stop_loss":
        return "Stop loss required"
    if key == "max_loss_per_trade":
        if config.max_loss_per_trade_mode == "percent":
            return f"{float(config.max_loss_per_trade_value):g}%"
        return f"{float(config.max_loss_per_trade_value):g}"
    if key == "max_loss_per_day":
        return f"{float(config.max_loss_per_day_value):g}"
    return ""


def builtin_evaluators() -> dict[str, Callable[..., RuleResult]]:
    """Registry used when adding future built-in rule types."""
    return {
        "trading_hours": lambda **kw: evaluate_trading_hours(kw["config"], kw["trades"], kw["tz_name"]),
        "start_day": lambda **kw: evaluate_start_day(
            kw["config"], kw["started_at"], kw["day"], kw["today"], kw["tz_name"]
        ),
        "link_playbook": lambda **kw: evaluate_playbook(kw["trades"]),
        "stop_loss": lambda **kw: evaluate_stop_loss(kw["trades"]),
        "max_loss_per_trade": lambda **kw: evaluate_max_loss_per_trade(kw["config"], kw["trades"]),
        "max_loss_per_day": lambda **kw: evaluate_max_loss_per_day(kw["config"], kw["trades"]),
    }


def enabled_builtin_keys(config: ConfigSnapshot) -> list[str]:
    flags = [
        ("trading_hours", config.trading_hours_enabled),
        ("start_day", config.start_day_enabled),
        ("link_playbook", config.link_playbook_enabled),
        ("stop_loss", config.stop_loss_required),
        ("max_loss_per_trade", config.max_loss_per_trade_enabled),
        ("max_loss_per_day", config.max_loss_per_day_enabled),
    ]
    return [key for key, enabled in flags if enabled]


def evaluate_daily_progress(
    *,
    day: date,
    today: date,
    tz_name: str,
    config: ConfigSnapshot | None,
    trades: list[TradeSnapshot],
    started_at: datetime | None,
    completions: dict[UUID, bool],
    tracking: bool,
) -> DailyEvaluation:
    participated = started_at is not None
    if config is None or not tracking:
        return DailyEvaluation(
            date=day,
            is_trading_day=False,
            participated=participated,
            started_at=started_at,
            tracking=False,
            results=[],
            passed=0,
            failed=0,
            pending=0,
            not_applicable=0,
            total_rules=0,
            score=None,
        )

    trading_day = is_active_day(day, list(config.active_days))
    if not trading_day:
        return DailyEvaluation(
            date=day,
            is_trading_day=False,
            participated=participated,
            started_at=started_at,
            tracking=True,
            results=[],
            passed=0,
            failed=0,
            pending=0,
            not_applicable=0,
            total_rules=0,
            score=None,
        )

    if day > today:
        return DailyEvaluation(
            date=day,
            is_trading_day=True,
            participated=False,
            started_at=None,
            tracking=True,
            results=[],
            passed=0,
            failed=0,
            pending=0,
            not_applicable=0,
            total_rules=0,
            score=None,
        )

    ctx = {
        "config": config,
        "trades": trades,
        "started_at": started_at,
        "day": day,
        "today": today,
        "tz_name": tz_name,
    }
    results: list[RuleResult] = []
    evaluators = builtin_evaluators()
    for key in enabled_builtin_keys(config):
        results.append(evaluators[key](**ctx))

    for rule in sorted(config.manual_rules, key=lambda r: (r.sort_order, r.name.lower())):
        if not rule.is_active:
            continue
        results.append(
            evaluate_manual_rule(rule, day, today, bool(completions.get(rule.id)))
        )

    passed = _count(results, "passed")
    failed = _count(results, "failed")
    pending = _count(results, "pending")
    not_applicable = _count(results, "not_applicable")
    return DailyEvaluation(
        date=day,
        is_trading_day=True,
        participated=participated,
        started_at=started_at,
        tracking=True,
        results=results,
        passed=passed,
        failed=failed,
        pending=pending,
        not_applicable=not_applicable,
        total_rules=len(results),
        score=_score(passed, failed, pending),
    )


def journaling_streak(
    *,
    today: date,
    active_days: list[str],
    participated_dates: set[date],
    first_effective: date | None,
) -> int:
    """Consecutive active trading days, walking backward from today, that were started.

    Inactive weekdays are skipped and do not break the streak. Future dates are ignored.
    Days before the tracker existed do not count.
    """
    from datetime import timedelta

    # Today without a start does not break a streak still in progress.
    cursor = today if today in participated_dates else today - timedelta(days=1)

    streak = 0
    guard = 0
    while guard < 800:
        guard += 1
        if first_effective and cursor < first_effective:
            break
        if is_active_day(cursor, active_days):
            if cursor not in participated_dates:
                break
            streak += 1
        cursor -= timedelta(days=1)
    return streak


def rule_streak(statuses: list[tuple[date, RuleStatus]], today: date) -> int:
    """Current consecutive passed days for one rule, skipping days that were not applicable."""
    relevant = [(d, s) for d, s in statuses if d <= today and s in ("passed", "failed", "pending")]
    relevant.sort(key=lambda item: item[0], reverse=True)
    streak = 0
    for _, status in relevant:
        if status == "passed":
            streak += 1
            continue
        break
    return streak


def follow_rate(passed: int, failed: int, pending: int = 0) -> float | None:
    total = passed + failed + pending
    if total <= 0:
        return None
    return round(100.0 * passed / total, 1)
