from datetime import date, datetime, timezone
from uuid import uuid4

from app.services.progress_rule_engine import (
    ConfigSnapshot,
    ManualRuleSnapshot,
    TradeSnapshot,
    evaluate_daily_progress,
    evaluate_max_loss_per_day,
    evaluate_max_loss_per_trade,
    evaluate_playbook,
    evaluate_start_day,
    evaluate_stop_loss,
    evaluate_trading_hours,
    follow_rate,
    journaling_streak,
    rule_streak,
)
from app.services.progress_time import is_active_day, local_date, resolve_timezone, time_in_window
from app.schemas.progress_tracker import ProgressTrackerSettingsUpdate
from pydantic import ValidationError
import pytest


def test_settings_reject_empty_trading_days():
    with pytest.raises(ValidationError):
        ProgressTrackerSettingsUpdate(active_days=[])


def test_settings_reject_percent_over_100():
    with pytest.raises(ValidationError):
        ProgressTrackerSettingsUpdate(
            max_loss_per_trade_enabled=True,
            max_loss_per_trade_mode="percent",
            max_loss_per_trade_value=150,
        )


def test_settings_reject_equal_trading_hours():
    with pytest.raises(ValidationError):
        ProgressTrackerSettingsUpdate(
            trading_hours_enabled=True,
            trading_start_time="14:00",
            trading_end_time="14:00",
        )


def test_settings_accept_overnight_window():
    payload = ProgressTrackerSettingsUpdate(
        trading_hours_enabled=True,
        trading_start_time="22:00",
        trading_end_time="02:00",
    )
    assert payload.trading_start_time == "22:00"


def test_manual_rule_requires_name():
    with pytest.raises(ValidationError):
        ProgressTrackerSettingsUpdate(manual_rules=[{"name": "  ", "schedule": ["mon"]}])



def _trade(**kwargs) -> TradeSnapshot:
    defaults = dict(
        opened_at=datetime(2026, 9, 16, 13, 0, tzinfo=timezone.utc),
        closed_at=datetime(2026, 9, 16, 14, 0, tzinfo=timezone.utc),
        pnl=100.0,
        stop_loss=10.0,
        playbook_id=uuid4(),
        account_id=uuid4(),
        account_balance=10000.0,
        status="closed",
        is_deleted=False,
    )
    defaults.update(kwargs)
    return TradeSnapshot(**defaults)


def _config(**kwargs) -> ConfigSnapshot:
    defaults = dict(
        active_days=("mon", "tue", "wed", "thu", "fri"),
        trading_hours_enabled=True,
        trading_start_time="14:00",
        trading_end_time="16:00",
        start_day_enabled=True,
        start_day_time="14:00",
        link_playbook_enabled=True,
        stop_loss_required=True,
        max_loss_per_trade_enabled=True,
        max_loss_per_trade_mode="amount",
        max_loss_per_trade_value=300.0,
        max_loss_per_day_enabled=True,
        max_loss_per_day_value=5000.0,
        manual_rules=(),
    )
    defaults.update(kwargs)
    return ConfigSnapshot(**defaults)


def test_timezone_day_boundary_not_utc():
    # 2026-09-16 22:30 UTC is still Sep 16 in UTC, but Sep 17 in Tokyo.
    stamp = datetime(2026, 9, 16, 22, 30, tzinfo=timezone.utc)
    assert local_date(stamp, resolve_timezone("UTC")) == date(2026, 9, 16)
    assert local_date(stamp, resolve_timezone("Asia/Tokyo")) == date(2026, 9, 17)


def test_weekend_does_not_count_as_active():
    assert is_active_day(date(2026, 9, 18), ["mon", "tue", "wed", "thu", "fri"])  # Friday
    assert not is_active_day(date(2026, 9, 19), ["mon", "tue", "wed", "thu", "fri"])  # Saturday
    assert not is_active_day(date(2026, 9, 20), ["mon", "tue", "wed", "thu", "fri"])  # Sunday


def test_overnight_trading_window():
    from datetime import time

    assert time_in_window(time(23, 0), "22:00", "02:00")
    assert time_in_window(time(1, 0), "22:00", "02:00")
    assert not time_in_window(time(10, 0), "22:00", "02:00")


def test_trading_hours_pass_and_fail():
    tz = "UTC"
    inside = _trade(opened_at=datetime(2026, 9, 16, 14, 30, tzinfo=timezone.utc))
    outside = _trade(opened_at=datetime(2026, 9, 16, 10, 0, tzinfo=timezone.utc))
    cfg = _config()
    assert evaluate_trading_hours(cfg, [inside], tz).status == "passed"
    assert evaluate_trading_hours(cfg, [outside], tz).status == "failed"
    assert evaluate_trading_hours(cfg, [], tz).status == "not_applicable"


def test_start_day_on_time_late_and_pending():
    cfg = _config(start_day_time="14:00")
    on_time = datetime(2026, 9, 16, 13, 59, tzinfo=timezone.utc)
    late = datetime(2026, 9, 16, 14, 1, tzinfo=timezone.utc)
    today = date(2026, 9, 16)
    assert evaluate_start_day(cfg, on_time, today, today, "UTC").status == "passed"
    assert evaluate_start_day(cfg, late, today, today, "UTC").status == "failed"
    assert evaluate_start_day(cfg, None, today, today, "UTC").status == "pending"
    assert evaluate_start_day(cfg, None, date(2026, 9, 15), today, "UTC").status == "failed"


def test_playbook_and_stop_loss():
    linked = _trade(playbook_id=uuid4(), stop_loss=12)
    missing = _trade(playbook_id=None, stop_loss=None)
    assert evaluate_playbook([linked]).status == "passed"
    assert evaluate_playbook([linked, missing]).status == "failed"
    assert evaluate_playbook([]).status == "not_applicable"
    assert evaluate_stop_loss([linked]).status == "passed"
    assert evaluate_stop_loss([missing]).status == "failed"
    assert evaluate_stop_loss([]).status == "not_applicable"


def test_max_loss_per_trade_amount_and_percent():
    ok = _trade(pnl=-200, account_balance=10000)
    bad = _trade(pnl=-400, account_balance=10000)
    cfg = _config(max_loss_per_trade_mode="amount", max_loss_per_trade_value=300)
    assert evaluate_max_loss_per_trade(cfg, [ok]).status == "passed"
    assert evaluate_max_loss_per_trade(cfg, [bad]).status == "failed"
    pct = _config(max_loss_per_trade_mode="percent", max_loss_per_trade_value=2)
    # 2% of 10000 = 200
    assert evaluate_max_loss_per_trade(pct, [ok]).status == "passed"
    assert evaluate_max_loss_per_trade(pct, [_trade(pnl=-250, account_balance=10000)]).status == "failed"


def test_max_loss_per_day_aggregates_canonical_pnl():
    cfg = _config(max_loss_per_day_value=500)
    trades = [_trade(pnl=-200), _trade(pnl=-200)]
    assert evaluate_max_loss_per_day(cfg, trades).status == "passed"
    trades.append(_trade(pnl=-200))
    assert evaluate_max_loss_per_day(cfg, trades).status == "failed"


def test_daily_score_and_manual_rules():
    rule_id = uuid4()
    cfg = _config(
        trading_hours_enabled=False,
        start_day_enabled=False,
        link_playbook_enabled=False,
        stop_loss_required=False,
        max_loss_per_trade_enabled=False,
        max_loss_per_day_enabled=False,
        manual_rules=(
            ManualRuleSnapshot(
                id=rule_id,
                name="Go To Gym",
                schedule=("mon", "tue", "wed", "thu", "fri"),
                sort_order=0,
                is_active=True,
            ),
        ),
    )
    today = date(2026, 9, 16)  # Wednesday
    pending = evaluate_daily_progress(
        day=today,
        today=today,
        tz_name="UTC",
        config=cfg,
        trades=[],
        started_at=None,
        completions={},
        tracking=True,
    )
    assert pending.pending == 1
    assert pending.score == 0
    done = evaluate_daily_progress(
        day=today,
        today=today,
        tz_name="UTC",
        config=cfg,
        trades=[],
        started_at=None,
        completions={rule_id: True},
        tracking=True,
    )
    assert done.passed == 1
    assert done.score == 100


def test_non_trading_day_has_no_score():
    saturday = date(2026, 9, 19)
    ev = evaluate_daily_progress(
        day=saturday,
        today=saturday,
        tz_name="UTC",
        config=_config(),
        trades=[],
        started_at=None,
        completions={},
        tracking=True,
    )
    assert ev.is_trading_day is False
    assert ev.score is None
    assert ev.results == []


def test_future_day_not_failed():
    ev = evaluate_daily_progress(
        day=date(2026, 9, 17),
        today=date(2026, 9, 16),
        tz_name="UTC",
        config=_config(),
        trades=[],
        started_at=None,
        completions={},
        tracking=True,
    )
    assert ev.score is None
    assert ev.failed == 0


def test_historical_untracked_has_no_results():
    ev = evaluate_daily_progress(
        day=date(2026, 5, 10),
        today=date(2026, 9, 16),
        tz_name="UTC",
        config=_config(),
        trades=[],
        started_at=None,
        completions={},
        tracking=False,
    )
    assert ev.tracking is False
    assert ev.results == []
    assert ev.score is None


def test_weekend_does_not_break_journaling_streak():
    # Friday and Monday started; Saturday/Sunday skipped.
    participated = {date(2026, 9, 18), date(2026, 9, 21)}
    streak = journaling_streak(
        today=date(2026, 9, 21),
        active_days=["mon", "tue", "wed", "thu", "fri"],
        participated_dates=participated,
        first_effective=date(2026, 9, 1),
    )
    assert streak == 2


def test_today_pending_does_not_break_prior_streak():
    participated = {date(2026, 9, 15)}  # Tuesday
    streak = journaling_streak(
        today=date(2026, 9, 16),  # Wednesday, not started yet
        active_days=["mon", "tue", "wed", "thu", "fri"],
        participated_dates=participated,
        first_effective=date(2026, 9, 1),
    )
    assert streak == 1


def test_rule_streak_resets_on_fail():
    statuses = [
        (date(2026, 9, 14), "passed"),
        (date(2026, 9, 15), "passed"),
        (date(2026, 9, 16), "failed"),
    ]
    assert rule_streak(statuses, date(2026, 9, 16)) == 0
    statuses[-1] = (date(2026, 9, 16), "passed")
    assert rule_streak(statuses, date(2026, 9, 16)) == 3


def test_follow_rate():
    assert follow_rate(7, 3) == 70.0
    assert follow_rate(0, 0) is None
