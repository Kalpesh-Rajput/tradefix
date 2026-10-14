"""Trade time-offset detection (backtesting 2A, D-013, D-022, D-023)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import numpy as np
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.api.deps import get_current_user
from app.core.db import get_db
from app.main import app
from app.models.time_offset import AccountTimeOffset
from app.models.trade import Trade, TradeStatus
from app.services.marketdata.candles import MINUTE_MS, Candles
from app.services.marketdata.coverage import record_fetch, reset_coverage
from app.services.marketdata.registry import get_instrument, mirror_to_db
from app.services.marketdata.store import LocalParquetStore, get_store
from app.services.marketdata.time_offsets import (
    Candidate,
    candidates_for,
    confidence_for,
    detect_account,
    effective_utc,
    parse_candidate,
)
from tests.bt_support import db, make_account, make_user, requires_db  # noqa: F401

pytestmark = requires_db

UTC = timezone.utc
EURUSD = get_instrument("EURUSD")
START = datetime(2026, 3, 2, tzinfo=UTC)
END = datetime(2026, 3, 21, tzinfo=UTC)
START_MS = int(START.timestamp() * 1000)


def _price(ms: int) -> float:
    return 1.0 + (ms - START_MS) / MINUTE_MS * 0.0001


def _candles(start: datetime, end: datetime) -> Candles:
    ts = np.arange(int(start.timestamp() * 1000), int(end.timestamp() * 1000), MINUTE_MS, dtype=np.int64)
    mid = 1.0 + (ts - START_MS) / MINUTE_MS * 0.0001
    return Candles.from_columns(
        {"ts": ts, "open": mid, "high": mid + 0.00005, "low": mid - 0.00005, "close": mid, "volume": np.ones(ts.size)}
    )


@pytest.fixture()
def env(db, tmp_path):  # noqa: F811
    mirror_to_db(db)
    reset_coverage(db, "EURUSD")
    db.execute(delete(AccountTimeOffset))
    store = LocalParquetStore(tmp_path)
    record_fetch(db, store, EURUSD, int(START.timestamp() * 1000), int(END.timestamp() * 1000), _candles(START, END))
    db.flush()
    return db, store


def _trade(db, user, account, true_utc: datetime, wall: datetime, basis: str = "naive_wall_clock"):  # noqa: F811
    ms = int(true_utc.timestamp() * 1000)
    trade = Trade(
        user_id=user.id,
        account_id=account.id,
        symbol="EURUSD",
        quantity=1,
        entry_price=Decimal(str(round(_price(ms - ms % MINUTE_MS), 5))),
        opened_at=wall.replace(tzinfo=UTC),
        status=TradeStatus.open,
        time_basis=basis,
    )
    db.add(trade)
    return trade


def _times(days: list[int], hour: int = 10) -> list[datetime]:
    return [datetime(2026, 3, d, hour, 17, tzinfo=UTC) for d in days]


WEEKDAYS = [3, 4, 5, 6, 9, 10, 11, 12, 13, 16, 17, 18]


def test_true_utc_is_detected(env):
    db, store = env
    user = make_user(db, timezone="Asia/Kolkata")
    account = make_account(db, user)
    for moment in _times(WEEKDAYS):
        _trade(db, user, account, moment, moment.replace(tzinfo=None))
    db.flush()
    row = detect_account(db, account, store=store)
    assert row.tz_value == "UTC" and row.tz_kind == "iana"
    assert row.confidence == "high" and row.match_rate == 1.0 and row.sample_size == 12


def test_ny_close_server_time_across_us_dst(env):
    db, store = env
    user = make_user(db)
    account = make_account(db, user)
    ny = ZoneInfo("America/New_York")
    for moment in _times(WEEKDAYS):
        server_wall = moment.astimezone(ny).replace(tzinfo=None) + timedelta(hours=7)
        _trade(db, user, account, moment, server_wall)
    db.flush()
    row = detect_account(db, account, store=store)
    assert row.tz_kind == "ny_close" and row.confidence == "high" and row.match_rate == 1.0
    assert row.scores["Etc/GMT-2"] == pytest.approx(4 / 12, abs=1e-4)
    assert row.scores["Etc/GMT-3"] == pytest.approx(8 / 12, abs=1e-4)
    assert row.runner_up == "Etc/GMT-3"


def test_user_local_kolkata_wall_clock(env):
    db, store = env
    user = make_user(db, timezone="Asia/Kolkata")
    account = make_account(db, user)
    ist = ZoneInfo("Asia/Kolkata")
    for moment in _times(WEEKDAYS, hour=6):
        _trade(db, user, account, moment, moment.astimezone(ist).replace(tzinfo=None))
    db.flush()
    row = detect_account(db, account, store=store)
    assert row.tz_value == "Asia/Kolkata" and row.confidence == "high"


def test_ny_close_wins_a_summer_only_tie_with_fixed_utc_plus_3(env):
    db, store = env
    user = make_user(db)
    account = make_account(db, user)
    ny = ZoneInfo("America/New_York")
    for moment in _times([9, 10, 11, 12, 13, 16, 17, 18]):
        _trade(db, user, account, moment, moment.astimezone(ny).replace(tzinfo=None) + timedelta(hours=7))
    db.flush()
    row = detect_account(db, account, store=store)
    assert row.scores["NY_CLOSE"] == row.scores["Etc/GMT-3"] == 1.0
    assert row.tz_kind == "ny_close" and row.runner_up != "Etc/GMT-3"


def test_small_sample_is_unknown(env):
    db, store = env
    user = make_user(db)
    account = make_account(db, user)
    for moment in _times([3, 4, 5]):
        _trade(db, user, account, moment, moment.replace(tzinfo=None))
    db.flush()
    row = detect_account(db, account, store=store)
    assert row.confidence == "unknown" and row.sample_size == 3


def test_no_candle_data_means_detection_does_not_run(env):
    db, store = env
    user = make_user(db)
    account = make_account(db, user)
    for moment in _times([3, 4, 5, 6, 9, 10]):
        moved = moment.replace(year=2025)
        _trade(db, user, account, moved, moved.replace(tzinfo=None))
    db.flush()
    assert detect_account(db, account, store=store) is None
    assert db.scalar(select(AccountTimeOffset).where(AccountTimeOffset.account_id == account.id)) is None


def test_utc_aware_trades_are_ignored_unless_forced(env):
    db, store = env
    user = make_user(db)
    account = make_account(db, user)
    for moment in _times(WEEKDAYS):
        _trade(db, user, account, moment, moment.replace(tzinfo=None), basis="utc_aware")
    db.flush()
    assert detect_account(db, account, store=store) is None
    forced = detect_account(db, account, store=store, force_naive=True)
    assert forced.tz_value == "UTC" and forced.method == "price_match_v1_forced"


def test_rerun_updates_the_same_row(env):
    db, store = env
    user = make_user(db)
    account = make_account(db, user)
    for moment in _times([3, 4, 5]):
        _trade(db, user, account, moment, moment.replace(tzinfo=None))
    db.flush()
    assert detect_account(db, account, store=store).confidence == "unknown"
    for moment in _times([9, 10, 11, 12, 13, 16, 17]):
        _trade(db, user, account, moment, moment.replace(tzinfo=None))
    db.flush()
    assert detect_account(db, account, store=store).confidence == "high"
    assert len(db.scalars(select(AccountTimeOffset).where(AccountTimeOffset.account_id == account.id)).all()) == 1


def test_candidates_and_conversion():
    labels = [c.label for c in candidates_for("Asia/Kolkata", extra="UTC,+05:30,Not/AZone,NY_CLOSE")]
    assert labels == ["UTC", "Asia/Kolkata", "NY_CLOSE", "Etc/GMT-2", "Etc/GMT-3", "+05:30"]
    wall = datetime(2026, 7, 1, 12, 0)
    assert parse_candidate("+05:30").to_utc(wall) == datetime(2026, 7, 1, 6, 30, tzinfo=UTC)
    assert parse_candidate("Etc/GMT-3").to_utc(wall) == datetime(2026, 7, 1, 9, 0, tzinfo=UTC)
    assert parse_candidate("NY_CLOSE").to_utc(wall) == datetime(2026, 7, 1, 9, 0, tzinfo=UTC)
    assert parse_candidate("NY_CLOSE").to_utc(datetime(2026, 1, 5, 12, 0)) == datetime(2026, 1, 5, 10, 0, tzinfo=UTC)


def test_confidence_rules():
    assert confidence_for(1.0, 1.0, 4, min_sample=5) == "unknown"
    assert confidence_for(0.0, 0.0, 20) == "unknown"
    assert confidence_for(0.9, 0.5, 12) == "high"
    assert confidence_for(0.9, 0.5, 6) == "medium"
    assert confidence_for(0.7, 0.05, 12) == "low"


def test_effective_utc_fallback_order():
    stored = datetime(2026, 3, 10, 12, 0, tzinfo=UTC)
    aware = effective_utc(stored, "utc_aware", None, "Asia/Kolkata")
    assert aware.utc == stored and aware.rule == "utc_aware"
    detected = SimpleNamespace(confidence="medium", tz_kind="iana", tz_value="Etc/GMT-2")
    via_offset = effective_utc(stored, "naive_wall_clock", detected, "Asia/Kolkata")
    assert via_offset.rule == "detected_offset" and via_offset.utc == datetime(2026, 3, 10, 10, 0, tzinfo=UTC)
    weak = SimpleNamespace(confidence="low", tz_kind="iana", tz_value="Etc/GMT-2")
    profile = effective_utc(stored, "naive_wall_clock", weak, "Asia/Kolkata")
    assert profile.rule == "profile_timezone" and profile.utc == datetime(2026, 3, 10, 6, 30, tzinfo=UTC)
    unknown = effective_utc(stored, "unknown", weak, "Asia/Kolkata")
    assert unknown.rule == "stored_utc" and unknown.utc == stored
    ny = effective_utc(stored, "unknown", SimpleNamespace(confidence="high", tz_kind="ny_close", tz_value="America/New_York+7"), None)
    assert ny.tz_label == "NY_CLOSE" and ny.utc == datetime(2026, 3, 10, 9, 0, tzinfo=UTC)


def test_admin_report_requires_admin(env):
    db, store = env
    user = make_user(db)
    account = make_account(db, user)
    for moment in _times(WEEKDAYS):
        _trade(db, user, account, moment, moment.replace(tzinfo=None))
    db.flush()
    detect_account(db, account, store=store)
    app.dependency_overrides[get_db] = lambda: db
    try:
        app.dependency_overrides[get_current_user] = lambda: user
        client = TestClient(app)
        assert client.get("/api/admin/time-offsets").status_code == 403
        admin = make_user(db, role="admin")
        app.dependency_overrides[get_current_user] = lambda: admin
        response = client.get("/api/admin/time-offsets")
        assert response.status_code == 200
        mine = [r for r in response.json() if r["account_id"] == str(account.id)]
        assert mine and mine[0]["tz_value"] == "UTC" and mine[0]["user_email"] == user.email
    finally:
        app.dependency_overrides.clear()
    assert TestClient(app).get("/api/admin/time-offsets").status_code == 401


@pytest.mark.seeded
def test_seeded_ny_close_account_detected(db):  # noqa: F811
    from app.services.marketdata.coverage import covered_ranges
    from app.services.marketdata.operations import previous_full_month

    spec = get_instrument("BTCUSDT")
    start, end = previous_full_month()
    if not any(a <= start and b >= end for a, b in covered_ranges(db, spec.symbol, spec.source)):
        pytest.skip("BTCUSDT not seeded; run seed-demo")
    raw = get_store().read(spec.source, spec.symbol, start, end)
    user = make_user(db)
    account = make_account(db, user)
    ny = ZoneInfo("America/New_York")
    rng = np.random.default_rng(7)
    for index in rng.choice(np.arange(1440, len(raw) - 1440), size=20, replace=False):
        moment = datetime.fromtimestamp(int(raw.ts[index]) / 1000, tz=UTC)
        db.add(
            Trade(
                user_id=user.id,
                account_id=account.id,
                symbol="BTCUSDT",
                quantity=1,
                entry_price=Decimal(str(float(raw.close[index]))),
                opened_at=(moment.astimezone(ny).replace(tzinfo=None) + timedelta(hours=7)).replace(tzinfo=UTC),
                status=TradeStatus.open,
                time_basis="naive_wall_clock",
            )
        )
    db.flush()
    row = detect_account(db, account)
    assert row.tz_kind == "ny_close" and row.confidence == "high", row.scores


def test_candidate_dataclass_is_hashable():
    assert len({Candidate("UTC", "iana", "UTC"), Candidate("UTC", "iana", "UTC")}) == 1
