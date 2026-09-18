"""Progress Tracker persistence, config versioning, and evaluation orchestration."""

from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import and_, delete, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.account import Account
from app.models.daily_checkin import DailyCheckin
from app.models.daily_recap import DailyRecap
from app.models.day_note import DayNote
from app.models.progress_tracker import (
    ProgressTrackerConfigVersion,
    ProgressTrackerDailyResult,
    ProgressTrackerDayStart,
    ProgressTrackerManualCompletion,
    ProgressTrackerManualRule,
    ProgressTrackerSettings,
)
from app.models.trade import Trade
from app.models.user import User
from app.schemas.progress_tracker import (
    DailyProgressResponse,
    HeatmapCellResponse,
    ManualCompletionResponse,
    ManualRuleInput,
    ManualRuleResponse,
    ProgressTrackerSettingsResponse,
    ProgressTrackerSettingsUpdate,
    ProgressTrackerSummaryResponse,
    ResetProgressResponse,
    RuleAnalyticsResponse,
    RuleResultResponse,
    StartDayResponse,
)
from app.services.progress_rule_engine import (
    ConfigSnapshot,
    DailyEvaluation,
    ManualRuleSnapshot,
    TradeSnapshot,
    builtin_condition,
    evaluate_daily_progress,
    follow_rate,
    journaling_streak,
    rule_streak,
    trades_for_day,
)
from app.services.progress_time import (
    daterange,
    day_bounds_utc,
    is_active_day,
    local_date,
    now_in_tz,
    resolve_timezone,
    today_in_tz,
)

logger = logging.getLogger("tradefix.progress_tracker")

SETTINGS_FIELDS = (
    "active_days",
    "reminder_enabled",
    "reminder_time",
    "trading_hours_enabled",
    "trading_start_time",
    "trading_end_time",
    "start_day_enabled",
    "start_day_time",
    "link_playbook_enabled",
    "stop_loss_required",
    "max_loss_per_trade_enabled",
    "max_loss_per_trade_mode",
    "max_loss_per_trade_value",
    "max_loss_per_day_enabled",
    "max_loss_per_day_value",
)


def _tz(user: User):
    return resolve_timezone(user.timezone)


def _default_settings_kwargs() -> dict:
    return {
        "active_days": ["mon", "tue", "wed", "thu", "fri"],
        "reminder_enabled": False,
        "reminder_time": "20:15",
        "trading_hours_enabled": False,
        "trading_start_time": "09:30",
        "trading_end_time": "16:00",
        "start_day_enabled": False,
        "start_day_time": "09:00",
        "link_playbook_enabled": False,
        "stop_loss_required": False,
        "max_loss_per_trade_enabled": False,
        "max_loss_per_trade_mode": "amount",
        "max_loss_per_trade_value": Decimal("0"),
        "max_loss_per_day_enabled": False,
        "max_loss_per_day_value": Decimal("0"),
    }


def _manual_payload(rule: ProgressTrackerManualRule) -> dict:
    return {
        "id": str(rule.id),
        "name": rule.name,
        "schedule": list(rule.schedule or []),
        "sort_order": rule.sort_order,
        "is_active": rule.is_active,
    }


def snapshot_from_settings(
    settings: ProgressTrackerSettings, rules: list[ProgressTrackerManualRule]
) -> dict:
    payload = {field: getattr(settings, field) for field in SETTINGS_FIELDS}
    payload["active_days"] = list(settings.active_days or [])
    payload["max_loss_per_trade_value"] = float(settings.max_loss_per_trade_value or 0)
    payload["max_loss_per_day_value"] = float(settings.max_loss_per_day_value or 0)
    payload["manual_rules"] = [_manual_payload(rule) for rule in rules if not rule.is_deleted]
    return payload


def config_from_snapshot(snapshot: dict | None) -> ConfigSnapshot | None:
    if not snapshot:
        return None
    manuals: list[ManualRuleSnapshot] = []
    for item in snapshot.get("manual_rules") or []:
        try:
            rule_id = uuid.UUID(str(item["id"]))
        except (KeyError, ValueError, TypeError):
            continue
        if item.get("is_active") is False:
            continue
        manuals.append(
            ManualRuleSnapshot(
                id=rule_id,
                name=str(item.get("name") or "Manual rule"),
                schedule=tuple(str(d) for d in (item.get("schedule") or [])),
                sort_order=int(item.get("sort_order") or 0),
                is_active=True,
            )
        )
    return ConfigSnapshot(
        active_days=tuple(str(d) for d in (snapshot.get("active_days") or ["mon", "tue", "wed", "thu", "fri"])),
        reminder_enabled=bool(snapshot.get("reminder_enabled")),
        reminder_time=str(snapshot.get("reminder_time") or "20:15"),
        trading_hours_enabled=bool(snapshot.get("trading_hours_enabled")),
        trading_start_time=str(snapshot.get("trading_start_time") or "09:30"),
        trading_end_time=str(snapshot.get("trading_end_time") or "16:00"),
        start_day_enabled=bool(snapshot.get("start_day_enabled")),
        start_day_time=str(snapshot.get("start_day_time") or "09:00"),
        link_playbook_enabled=bool(snapshot.get("link_playbook_enabled")),
        stop_loss_required=bool(snapshot.get("stop_loss_required")),
        max_loss_per_trade_enabled=bool(snapshot.get("max_loss_per_trade_enabled")),
        max_loss_per_trade_mode=str(snapshot.get("max_loss_per_trade_mode") or "amount"),
        max_loss_per_trade_value=float(snapshot.get("max_loss_per_trade_value") or 0),
        max_loss_per_day_enabled=bool(snapshot.get("max_loss_per_day_enabled")),
        max_loss_per_day_value=float(snapshot.get("max_loss_per_day_value") or 0),
        manual_rules=tuple(manuals),
    )


def get_or_create_settings(db: Session, user: User) -> ProgressTrackerSettings:
    row = db.scalar(select(ProgressTrackerSettings).where(ProgressTrackerSettings.user_id == user.id))
    if row:
        return row
    row = ProgressTrackerSettings(user_id=user.id, **_default_settings_kwargs())
    db.add(row)
    db.flush()
    _write_version(db, user, row, [])
    logger.info("Created default Progress Tracker settings user=%s", user.id)
    return row


def list_manual_rules(db: Session, user_id: uuid.UUID, include_deleted: bool = False) -> list[ProgressTrackerManualRule]:
    stmt = select(ProgressTrackerManualRule).where(ProgressTrackerManualRule.user_id == user_id)
    if not include_deleted:
        stmt = stmt.where(ProgressTrackerManualRule.is_deleted.is_(False))
    return list(db.scalars(stmt.order_by(ProgressTrackerManualRule.sort_order, ProgressTrackerManualRule.created_at)).all())


def _write_version(
    db: Session,
    user: User,
    settings: ProgressTrackerSettings,
    rules: list[ProgressTrackerManualRule],
) -> ProgressTrackerConfigVersion:
    today = today_in_tz(_tz(user))
    existing = db.scalar(
        select(ProgressTrackerConfigVersion).where(
            ProgressTrackerConfigVersion.user_id == user.id,
            ProgressTrackerConfigVersion.effective_from == today,
        )
    )
    payload = snapshot_from_settings(settings, rules)
    if existing:
        existing.snapshot = payload
        db.flush()
        return existing
    version = ProgressTrackerConfigVersion(user_id=user.id, effective_from=today, snapshot=payload)
    db.add(version)
    db.flush()
    return version


def _versions(db: Session, user_id: uuid.UUID) -> list[ProgressTrackerConfigVersion]:
    return list(
        db.scalars(
            select(ProgressTrackerConfigVersion)
            .where(ProgressTrackerConfigVersion.user_id == user_id)
            .order_by(ProgressTrackerConfigVersion.effective_from.asc(), ProgressTrackerConfigVersion.created_at.asc())
        ).all()
    )


def version_for_date(
    versions: list[ProgressTrackerConfigVersion], day: date
) -> ProgressTrackerConfigVersion | None:
    chosen: ProgressTrackerConfigVersion | None = None
    for version in versions:
        if version.effective_from <= day:
            chosen = version
        else:
            break
    return chosen


def first_effective_date(versions: list[ProgressTrackerConfigVersion]) -> date | None:
    if not versions:
        return None
    return min(v.effective_from for v in versions)


def settings_response(user: User, settings: ProgressTrackerSettings, rules: list[ProgressTrackerManualRule]) -> ProgressTrackerSettingsResponse:
    return ProgressTrackerSettingsResponse(
        active_days=list(settings.active_days or []),
        reminder_enabled=settings.reminder_enabled,
        reminder_time=settings.reminder_time,
        trading_hours_enabled=settings.trading_hours_enabled,
        trading_start_time=settings.trading_start_time,
        trading_end_time=settings.trading_end_time,
        start_day_enabled=settings.start_day_enabled,
        start_day_time=settings.start_day_time,
        link_playbook_enabled=settings.link_playbook_enabled,
        stop_loss_required=settings.stop_loss_required,
        max_loss_per_trade_enabled=settings.max_loss_per_trade_enabled,
        max_loss_per_trade_mode=settings.max_loss_per_trade_mode if settings.max_loss_per_trade_mode in ("amount", "percent") else "amount",
        max_loss_per_trade_value=float(settings.max_loss_per_trade_value or 0),
        max_loss_per_day_enabled=settings.max_loss_per_day_enabled,
        max_loss_per_day_value=float(settings.max_loss_per_day_value or 0),
        timezone=user.timezone or "UTC",
        manual_rules=[
            ManualRuleResponse(
                id=rule.id,
                name=rule.name,
                schedule=list(rule.schedule or []),
                sort_order=rule.sort_order,
                is_active=rule.is_active,
                created_at=rule.created_at,
                updated_at=rule.updated_at,
            )
            for rule in rules
            if not rule.is_deleted
        ],
    )


def get_settings(db: Session, user: User) -> ProgressTrackerSettingsResponse:
    settings = get_or_create_settings(db, user)
    rules = list_manual_rules(db, user.id)
    db.commit()
    return settings_response(user, settings, rules)


def _owned_account(db: Session, user: User, account_id: uuid.UUID | None) -> Account | None:
    if account_id is None:
        return None
    account = db.get(Account, account_id)
    if not account or account.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return account


def update_settings(db: Session, user: User, payload: ProgressTrackerSettingsUpdate) -> ProgressTrackerSettingsResponse:
    settings = get_or_create_settings(db, user)
    settings.active_days = payload.active_days
    settings.reminder_enabled = payload.reminder_enabled
    settings.reminder_time = payload.reminder_time
    settings.trading_hours_enabled = payload.trading_hours_enabled
    settings.trading_start_time = payload.trading_start_time
    settings.trading_end_time = payload.trading_end_time
    settings.start_day_enabled = payload.start_day_enabled
    settings.start_day_time = payload.start_day_time
    settings.link_playbook_enabled = payload.link_playbook_enabled
    settings.stop_loss_required = payload.stop_loss_required
    settings.max_loss_per_trade_enabled = payload.max_loss_per_trade_enabled
    settings.max_loss_per_trade_mode = payload.max_loss_per_trade_mode
    settings.max_loss_per_trade_value = Decimal(str(payload.max_loss_per_trade_value))
    settings.max_loss_per_day_enabled = payload.max_loss_per_day_enabled
    settings.max_loss_per_day_value = Decimal(str(payload.max_loss_per_day_value))

    existing = {rule.id: rule for rule in list_manual_rules(db, user.id, include_deleted=True)}
    keep_ids: set[uuid.UUID] = set()
    for index, item in enumerate(payload.manual_rules):
        row = existing.get(item.id) if item.id else None
        if row and row.user_id != user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Manual rule not found")
        if row:
            row.name = item.name
            row.schedule = item.schedule
            row.sort_order = index
            row.is_active = item.is_active
            row.is_deleted = False
            keep_ids.add(row.id)
        else:
            row = ProgressTrackerManualRule(
                user_id=user.id,
                name=item.name,
                schedule=item.schedule,
                sort_order=index,
                is_active=item.is_active,
            )
            db.add(row)
            db.flush()
            keep_ids.add(row.id)

    for rule in existing.values():
        if rule.id not in keep_ids and not rule.is_deleted:
            rule.is_deleted = True
            rule.is_active = False

    db.flush()
    rules = list_manual_rules(db, user.id)
    _write_version(db, user, settings, rules)
    today = today_in_tz(_tz(user))
    _delete_results_from(db, user.id, today)
    evaluate_day(db, user, today, persist=True)
    db.commit()
    db.refresh(settings)
    rules = list_manual_rules(db, user.id)
    return settings_response(user, settings, rules)


def _delete_results_from(db: Session, user_id: uuid.UUID, start: date) -> None:
    db.execute(
        delete(ProgressTrackerDailyResult).where(
            ProgressTrackerDailyResult.user_id == user_id,
            ProgressTrackerDailyResult.date >= start,
        )
    )


def _trade_snapshots(
    db: Session,
    user: User,
    start: date,
    end: date,
    account_id: uuid.UUID | None,
) -> list[TradeSnapshot]:
    tz = _tz(user)
    start_utc, _ = day_bounds_utc(start - timedelta(days=1), tz)
    _, end_utc = day_bounds_utc(end + timedelta(days=1), tz)
    stmt = (
        select(Trade)
        .options(selectinload(Trade.account))
        .where(
            Trade.user_id == user.id,
            Trade.is_deleted.is_(False),
            or_(
                and_(Trade.closed_at.is_not(None), Trade.closed_at >= start_utc, Trade.closed_at < end_utc),
                and_(Trade.closed_at.is_(None), Trade.opened_at >= start_utc, Trade.opened_at < end_utc),
            ),
        )
    )
    if account_id is not None:
        stmt = stmt.where(Trade.account_id == account_id)
    rows = list(db.scalars(stmt).all())
    snapshots: list[TradeSnapshot] = []
    for trade in rows:
        balance = float(trade.account.initial_balance) if trade.account is not None else 0.0
        snapshots.append(
            TradeSnapshot(
                opened_at=trade.opened_at,
                closed_at=trade.closed_at,
                pnl=float(trade.pnl) if trade.pnl is not None else None,
                stop_loss=float(trade.stop_loss) if trade.stop_loss is not None else None,
                playbook_id=trade.playbook_id,
                account_id=trade.account_id,
                account_balance=balance,
                status=trade.status.value if hasattr(trade.status, "value") else str(trade.status),
                is_deleted=bool(trade.is_deleted),
            )
        )
    return snapshots


def _participation_map(
    db: Session,
    user: User,
    start: date,
    end: date,
) -> dict[date, datetime]:
    tz = _tz(user)
    starts = list(
        db.scalars(
            select(ProgressTrackerDayStart).where(
                ProgressTrackerDayStart.user_id == user.id,
                ProgressTrackerDayStart.date >= start,
                ProgressTrackerDayStart.date <= end,
            )
        ).all()
    )
    checkins = list(
        db.scalars(
            select(DailyCheckin).where(
                DailyCheckin.user_id == user.id,
                DailyCheckin.date >= start,
                DailyCheckin.date <= end,
            )
        ).all()
    )
    recaps = list(
        db.scalars(
            select(DailyRecap).where(
                DailyRecap.user_id == user.id,
                DailyRecap.date >= start,
                DailyRecap.date <= end,
            )
        ).all()
    )
    notes = list(
        db.scalars(
            select(DayNote).where(
                DayNote.user_id == user.id,
                DayNote.date >= start,
                DayNote.date <= end,
            )
        ).all()
    )
    earliest: dict[date, datetime] = {}

    def consider(day: date, stamp: datetime | None) -> None:
        if stamp is None:
            return
        current = earliest.get(day)
        if current is None or stamp < current:
            earliest[day] = stamp

    for row in starts:
        consider(row.date, row.started_at)
    for row in checkins:
        consider(row.date, row.created_at)
    for row in recaps:
        consider(row.date, row.created_at)
    for row in notes:
        consider(row.date, row.created_at)
    return earliest


def _completions_map(
    db: Session, user_id: uuid.UUID, start: date, end: date
) -> dict[date, dict[uuid.UUID, bool]]:
    rows = list(
        db.scalars(
            select(ProgressTrackerManualCompletion).where(
                ProgressTrackerManualCompletion.user_id == user_id,
                ProgressTrackerManualCompletion.date >= start,
                ProgressTrackerManualCompletion.date <= end,
            )
        ).all()
    )
    out: dict[date, dict[uuid.UUID, bool]] = {}
    for row in rows:
        out.setdefault(row.date, {})[row.rule_id] = bool(row.completed)
    return out


def _stored_results(
    db: Session,
    user_id: uuid.UUID,
    start: date,
    end: date,
    account_id: uuid.UUID | None,
) -> dict[date, ProgressTrackerDailyResult]:
    stmt = select(ProgressTrackerDailyResult).where(
        ProgressTrackerDailyResult.user_id == user_id,
        ProgressTrackerDailyResult.date >= start,
        ProgressTrackerDailyResult.date <= end,
    )
    if account_id is None:
        stmt = stmt.where(ProgressTrackerDailyResult.account_id.is_(None))
    else:
        stmt = stmt.where(ProgressTrackerDailyResult.account_id == account_id)
    return {row.date: row for row in db.scalars(stmt).all()}


def _daily_from_stored(row: ProgressTrackerDailyResult, today: date) -> DailyEvaluation:
    from app.services.progress_rule_engine import RuleResult

    results: list[RuleResult] = []
    for item in row.results or []:
        rule_id = item.get("rule_id")
        results.append(
            RuleResult(
                rule_key=str(item.get("rule_key") or ""),
                rule_id=uuid.UUID(rule_id) if rule_id else None,
                name=str(item.get("name") or ""),
                kind="manual" if item.get("kind") == "manual" else "builtin",
                status=item.get("status") or "pending",
                condition=item.get("condition"),
                detail=item.get("detail"),
                metadata=item.get("metadata") or {},
            )
        )
    return DailyEvaluation(
        date=row.date,
        is_trading_day=True,
        participated=bool(row.participated),
        started_at=None,
        tracking=True,
        results=results,
        passed=row.passed_rules,
        failed=row.failed_rules,
        pending=row.pending_rules,
        not_applicable=row.not_applicable_rules,
        total_rules=row.total_rules,
        score=float(row.score) if row.score is not None else None,
    )


def _upsert_result(
    db: Session,
    user: User,
    evaluation: DailyEvaluation,
    account_id: uuid.UUID | None,
    version_id: uuid.UUID | None,
) -> ProgressTrackerDailyResult:
    stmt = select(ProgressTrackerDailyResult).where(
        ProgressTrackerDailyResult.user_id == user.id,
        ProgressTrackerDailyResult.date == evaluation.date,
    )
    if account_id is None:
        stmt = stmt.where(ProgressTrackerDailyResult.account_id.is_(None))
    else:
        stmt = stmt.where(ProgressTrackerDailyResult.account_id == account_id)
    row = db.scalar(stmt)
    payload = [item.to_dict() for item in evaluation.results]
    score = Decimal(str(evaluation.score)) if evaluation.score is not None else None
    if row is None:
        row = ProgressTrackerDailyResult(
            user_id=user.id,
            date=evaluation.date,
            account_id=account_id,
        )
        db.add(row)
    row.config_version_id = version_id
    row.total_rules = evaluation.total_rules
    row.passed_rules = evaluation.passed
    row.failed_rules = evaluation.failed
    row.pending_rules = evaluation.pending
    row.not_applicable_rules = evaluation.not_applicable
    row.score = score
    row.participated = evaluation.participated
    row.results = payload
    row.evaluated_at = datetime.now(timezone.utc)
    db.flush()
    return row


def evaluate_day(
    db: Session,
    user: User,
    day: date,
    *,
    account_id: uuid.UUID | None = None,
    persist: bool = True,
    trades: list[TradeSnapshot] | None = None,
    started_at: datetime | None = None,
    completions: dict[uuid.UUID, bool] | None = None,
    versions: list[ProgressTrackerConfigVersion] | None = None,
) -> DailyEvaluation:
    _owned_account(db, user, account_id)
    tz_name = user.timezone or "UTC"
    today = today_in_tz(_tz(user))
    versions = versions if versions is not None else _versions(db, user.id)
    version = version_for_date(versions, day)
    first = first_effective_date(versions)
    tracking = first is not None and day >= first
    config = config_from_snapshot(version.snapshot) if version else None

    if trades is None:
        trades = trades_for_day(_trade_snapshots(db, user, day, day, account_id), day, tz_name)
    if started_at is None:
        started_at = _participation_map(db, user, day, day).get(day)
    if completions is None:
        completions = _completions_map(db, user.id, day, day).get(day, {})

    evaluation = evaluate_daily_progress(
        day=day,
        today=today,
        tz_name=tz_name,
        config=config,
        trades=trades,
        started_at=started_at,
        completions=completions,
        tracking=tracking,
    )
    if persist and tracking and day <= today:
        _upsert_result(db, user, evaluation, account_id, version.id if version else None)
    return evaluation


def evaluate_range(
    db: Session,
    user: User,
    start: date,
    end: date,
    account_id: uuid.UUID | None,
) -> dict[date, DailyEvaluation]:
    if start > end:
        start, end = end, start
    tz = _tz(user)
    today = today_in_tz(tz)
    versions = _versions(db, user.id)
    first = first_effective_date(versions)
    trades = _trade_snapshots(db, user, start, end, account_id)
    participation = _participation_map(db, user, start, end)
    completions = _completions_map(db, user.id, start, end)
    stored = _stored_results(db, user.id, start, end, account_id)

    out: dict[date, DailyEvaluation] = {}
    for day in daterange(start, end):
        version = version_for_date(versions, day)
        tracking = first is not None and day >= first
        config = config_from_snapshot(version.snapshot) if version else None
        reuse_stored = (
            day < today
            and tracking
            and day in stored
            and stored[day].config_version_id == (version.id if version else None)
        )
        if reuse_stored:
            evaluation = _daily_from_stored(stored[day], today)
            evaluation.started_at = participation.get(day)
            evaluation.is_trading_day = is_active_day(day, list(config.active_days) if config else [])
            out[day] = evaluation
            continue
        day_trades = trades_for_day(trades, day, user.timezone or "UTC")
        evaluation = evaluate_daily_progress(
            day=day,
            today=today,
            tz_name=user.timezone or "UTC",
            config=config,
            trades=day_trades,
            started_at=participation.get(day),
            completions=completions.get(day, {}),
            tracking=tracking,
        )
        if tracking and day <= today:
            _upsert_result(db, user, evaluation, account_id, version.id if version else None)
        out[day] = evaluation
    return out


def reevaluate_dates(db: Session, user: User, dates: list[date]) -> None:
    unique_days = sorted({d for d in dates if d is not None})
    if not unique_days:
        return
    get_or_create_settings(db, user)
    accounts: list[uuid.UUID | None] = [None]
    accounts.extend(list(db.scalars(select(Account.id).where(Account.user_id == user.id)).all()))
    for day in unique_days:
        for account_id in accounts:
            evaluate_day(db, user, day, account_id=account_id)


def reevaluate_trade_datetimes(db: Session, user: User, stamps: list[datetime | None]) -> None:
    tz = _tz(user)
    days = [local_date(stamp, tz) for stamp in stamps if stamp is not None]
    if not days:
        return
    reevaluate_dates(db, user, days)


def touch_progress(db: Session, user: User, *values: date | datetime | None) -> None:
    """Best-effort reevaluation so trade/journal writes never fail on tracker errors."""
    try:
        days: list[date] = []
        tz = _tz(user)
        for value in values:
            if value is None:
                continue
            if isinstance(value, datetime):
                days.append(local_date(value, tz))
            else:
                days.append(value)
        if days:
            reevaluate_dates(db, user, days)
    except Exception:
        logger.exception("Progress Tracker reevaluation failed user=%s", user.id)


def _to_daily_response(evaluation: DailyEvaluation) -> DailyProgressResponse:
    return DailyProgressResponse(
        date=evaluation.date,
        is_trading_day=evaluation.is_trading_day,
        participated=evaluation.participated,
        started_at=evaluation.started_at,
        total_rules=evaluation.total_rules,
        passed=evaluation.passed,
        failed=evaluation.failed,
        pending=evaluation.pending,
        not_applicable=evaluation.not_applicable,
        score=evaluation.score,
        tracking=evaluation.tracking,
        rules=[
            RuleResultResponse(
                rule_key=item.rule_key,
                rule_id=item.rule_id,
                name=item.name,
                kind=item.kind,
                status=item.status,
                condition=item.condition,
                detail=item.detail,
                metadata=item.metadata,
            )
            for item in evaluation.results
        ],
    )


def get_daily(db: Session, user: User, day: date, account_id: uuid.UUID | None) -> DailyProgressResponse:
    get_or_create_settings(db, user)
    evaluation = evaluate_day(db, user, day, account_id=account_id, persist=True)
    db.commit()
    return _to_daily_response(evaluation)


def _analytics(
    evaluations: dict[date, DailyEvaluation],
    today: date,
    current: ConfigSnapshot | None,
) -> list[RuleAnalyticsResponse]:
    if current is None:
        return []
    catalog: list[tuple[str, uuid.UUID | None, str, str, str]] = []
    for key in (
        "trading_hours",
        "start_day",
        "link_playbook",
        "stop_loss",
        "max_loss_per_trade",
        "max_loss_per_day",
    ):
        enabled = {
            "trading_hours": current.trading_hours_enabled,
            "start_day": current.start_day_enabled,
            "link_playbook": current.link_playbook_enabled,
            "stop_loss": current.stop_loss_required,
            "max_loss_per_trade": current.max_loss_per_trade_enabled,
            "max_loss_per_day": current.max_loss_per_day_enabled,
        }[key]
        if not enabled:
            continue
        catalog.append((key, None, {
            "trading_hours": "Trading hours",
            "start_day": "Start my day by",
            "link_playbook": "Link trades to playbook",
            "stop_loss": "Input stop loss to all trades",
            "max_loss_per_trade": "Net max loss / trade",
            "max_loss_per_day": "Net max loss / day",
        }[key], "builtin", builtin_condition(current, key)))
    for rule in sorted(current.manual_rules, key=lambda r: (r.sort_order, r.name.lower())):
        from app.services.progress_rule_engine import _schedule_label

        catalog.append(
            (
                f"manual:{rule.id}",
                rule.id,
                rule.name,
                "manual",
                _schedule_label(rule.schedule),
            )
        )

    rows: list[RuleAnalyticsResponse] = []
    for key, rule_id, name, kind, condition in catalog:
        statuses: list[tuple[date, str]] = []
        passed = failed = pending = 0
        samples: list[float] = []
        for day, evaluation in sorted(evaluations.items()):
            if day > today or not evaluation.is_trading_day:
                continue
            match = next((item for item in evaluation.results if item.rule_key == key), None)
            if match is None:
                continue
            statuses.append((day, match.status))
            if match.status == "passed":
                passed += 1
            elif match.status == "failed":
                failed += 1
            elif match.status == "pending":
                pending += 1
            meta = match.metadata or {}
            if key == "trading_hours" and meta.get("compliance_ratio") is not None:
                samples.append(float(meta["compliance_ratio"]) * 100)
            elif key == "link_playbook" and meta.get("ratio") is not None:
                samples.append(float(meta["ratio"]) * 100)
            elif key == "stop_loss" and meta.get("ratio") is not None:
                samples.append(float(meta["ratio"]) * 100)
            elif key == "max_loss_per_trade" and meta.get("avg_loss") is not None:
                samples.append(float(meta["avg_loss"]))
            elif key == "max_loss_per_day" and meta.get("net_pnl") is not None:
                samples.append(float(meta["net_pnl"]))
            elif kind == "manual" and match.status in ("passed", "failed"):
                samples.append(100.0 if match.status == "passed" else 0.0)
        applicable = passed + failed + pending
        avg_label = None
        if samples:
            avg = sum(samples) / len(samples)
            if key in ("trading_hours", "link_playbook", "stop_loss") or kind == "manual":
                avg_label = f"{avg:.0f}%"
            elif key == "max_loss_per_trade":
                avg_label = f"{avg:.0f}"
            elif key == "max_loss_per_day":
                avg_label = f"{avg:.0f}"
        rows.append(
            RuleAnalyticsResponse(
                rule_key=key,
                rule_id=rule_id,
                name=name,
                kind=kind,  # type: ignore[arg-type]
                condition=condition,
                streak=rule_streak(statuses, today),  # type: ignore[arg-type]
                follow_rate=follow_rate(passed, failed, pending),
                average_performance=avg_label,
                passed=passed,
                failed=failed,
                pending=pending,
                applicable=applicable,
            )
        )
    return rows


def get_summary(
    db: Session,
    user: User,
    date_from: date,
    date_to: date,
    account_id: uuid.UUID | None,
    focus_date: date | None = None,
) -> ProgressTrackerSummaryResponse:
    settings = get_or_create_settings(db, user)
    rules = list_manual_rules(db, user.id)
    tz = _tz(user)
    today = today_in_tz(tz)
    if date_from > date_to:
        date_from, date_to = date_to, date_from
    # Keep heatmap queries bounded even if the picker is set to all-time.
    if (date_to - date_from).days > 400:
        date_from = date_to - timedelta(days=400)
    focus = focus_date or today
    eval_start = min(date_from, focus, today)
    eval_end = max(date_to, focus, today)
    evaluations = evaluate_range(db, user, eval_start, eval_end, account_id)
    db.commit()

    versions = _versions(db, user.id)
    first = first_effective_date(versions)
    current = config_from_snapshot(versions[-1].snapshot) if versions else config_from_snapshot(snapshot_from_settings(settings, rules))
    active_days = list(current.active_days) if current else list(settings.active_days or [])
    participation = {day for day, ev in evaluations.items() if ev.participated}
    # Include older participation for streak continuity beyond the visible range.
    older = _participation_map(db, user, (first or today) - timedelta(days=1) if first else today - timedelta(days=400), eval_start - timedelta(days=1) if eval_start else today)
    participation |= set(older.keys())

    streak = journaling_streak(
        today=today,
        active_days=active_days,
        participated_dates=participation,
        first_effective=first,
    )

    scored = [
        ev.score
        for day, ev in evaluations.items()
        if date_from <= day <= date_to and ev.score is not None and ev.is_trading_day and not (day > today)
    ]
    period_score = round(sum(scored) / len(scored), 1) if scored else None

    heatmap: list[HeatmapCellResponse] = []
    for day in daterange(date_from, date_to):
        ev = evaluations.get(day)
        future = day > today
        heatmap.append(
            HeatmapCellResponse(
                date=day,
                score=None if future else (ev.score if ev else None),
                passed=ev.passed if ev and not future else 0,
                failed=ev.failed if ev and not future else 0,
                pending=ev.pending if ev and not future else 0,
                total_applicable=(ev.passed + ev.failed + ev.pending) if ev and not future else 0,
                is_trading_day=ev.is_trading_day if ev else is_active_day(day, active_days),
                participated=bool(ev.participated) if ev else False,
                tracking=bool(ev.tracking) if ev else False,
                future=future,
            )
        )

    checklist = evaluations.get(focus) or evaluate_day(db, user, focus, account_id=account_id, persist=focus <= today)
    today_ev = evaluations.get(today) or checklist
    analytics = _analytics(evaluations, today, current)

    return ProgressTrackerSummaryResponse(
        timezone=user.timezone or "UTC",
        today=today,
        focus_date=focus,
        current_streak=streak,
        period_score=period_score,
        today_passed=today_ev.passed,
        today_total=today_ev.passed + today_ev.failed + today_ev.pending,
        settings=settings_response(user, settings, rules),
        checklist=_to_daily_response(checklist),
        heatmap=heatmap,
        rules=analytics,
    )


def start_day(db: Session, user: User, day: date | None) -> StartDayResponse:
    tz = _tz(user)
    today = today_in_tz(tz)
    target = day or today
    if target > today:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot start a future day")

    existing = db.scalar(
        select(ProgressTrackerDayStart).where(
            ProgressTrackerDayStart.user_id == user.id,
            ProgressTrackerDayStart.date == target,
        )
    )
    created = False
    if existing is None:
        existing = ProgressTrackerDayStart(
            user_id=user.id,
            date=target,
            started_at=now_in_tz(tz).astimezone(timezone.utc),
        )
        db.add(existing)
        created = True
        checkin = db.scalar(
            select(DailyCheckin).where(DailyCheckin.user_id == user.id, DailyCheckin.date == target)
        )
        if checkin is None:
            db.add(DailyCheckin(user_id=user.id, date=target))
        db.flush()
    get_or_create_settings(db, user)
    evaluate_day(db, user, target, persist=True)
    db.commit()
    db.refresh(existing)
    return StartDayResponse(
        date=existing.date,
        started_at=existing.started_at,
        created=created,
        already_started=not created,
    )


def set_manual_completion(
    db: Session,
    user: User,
    rule_id: uuid.UUID,
    day: date,
    completed: bool,
) -> ManualCompletionResponse:
    tz = _tz(user)
    today = today_in_tz(tz)
    if day > today:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot complete a future day")
    rule = db.get(ProgressTrackerManualRule, rule_id)
    if not rule or rule.user_id != user.id or rule.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Manual rule not found")

    row = db.scalar(
        select(ProgressTrackerManualCompletion).where(
            ProgressTrackerManualCompletion.user_id == user.id,
            ProgressTrackerManualCompletion.rule_id == rule_id,
            ProgressTrackerManualCompletion.date == day,
        )
    )
    stamp = datetime.now(timezone.utc) if completed else None
    if row is None:
        row = ProgressTrackerManualCompletion(
            user_id=user.id,
            rule_id=rule_id,
            date=day,
            completed=completed,
            completed_at=stamp,
        )
        db.add(row)
    else:
        row.completed = completed
        row.completed_at = stamp
    db.flush()
    evaluate_day(db, user, day, persist=True)
    db.commit()
    db.refresh(row)
    return ManualCompletionResponse(
        rule_id=row.rule_id,
        date=row.date,
        completed=row.completed,
        completed_at=row.completed_at,
    )


def reset_progress(db: Session, user: User) -> ResetProgressResponse:
    results = db.execute(
        delete(ProgressTrackerDailyResult).where(ProgressTrackerDailyResult.user_id == user.id)
    )
    completions = db.execute(
        delete(ProgressTrackerManualCompletion).where(ProgressTrackerManualCompletion.user_id == user.id)
    )
    starts = db.execute(
        delete(ProgressTrackerDayStart).where(ProgressTrackerDayStart.user_id == user.id)
    )
    settings = get_or_create_settings(db, user)
    rules = list_manual_rules(db, user.id)
    _write_version(db, user, settings, rules)
    db.commit()
    logger.info("Reset Progress Tracker history user=%s", user.id)
    return ResetProgressResponse(
        reset=True,
        deleted_results=results.rowcount or 0,
        deleted_completions=completions.rowcount or 0,
        deleted_day_starts=starts.rowcount or 0,
    )
