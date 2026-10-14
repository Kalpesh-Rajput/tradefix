"""Simulated trades never reach any journal reader (D-005), core readers (1B)."""

from __future__ import annotations

import re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.core.db import get_db
from app.main import app
from app.models.trade import Trade, TradeStatus
from app.schemas.trade_export import TradeExportFilters
from app.services import behavior, insight_rules, progress_tracker_service, stats_service, trade_export
from app.services.advanced_analytics import load
from app.services.advanced_analytics.core import Filters
from app.services.live_trades import get_live_trade, live_trades
from tests.bt_support import db, make_account, make_user, requires_db  # noqa: F401

pytestmark = requires_db

BASE = datetime(2026, 3, 2, 14, 30, tzinfo=timezone.utc)
SIM = "SIMX"


def _trade(user, account, *, symbol="EURUSD", simulated=False, pnl=50.0, opened=BASE, status=TradeStatus.closed, qty=1):
    return Trade(
        user_id=user.id,
        account_id=account.id,
        symbol=symbol,
        quantity=qty,
        entry_price=1.1,
        exit_price=1.2 if status == TradeStatus.closed else None,
        opened_at=opened,
        closed_at=opened + timedelta(minutes=20) if status == TradeStatus.closed else None,
        pnl=pnl if status == TradeStatus.closed else None,
        status=status,
        is_simulated=simulated,
        screenshot_urls=["/uploads/x.png"],
        emotion_tags=["Revenge Trading"] if simulated else [],
    )


@pytest.fixture()
def env(db):  # noqa: F811
    user = make_user(db)
    account = make_account(db, user)
    live = _trade(user, account)
    sim_closed = _trade(user, account, symbol=SIM, simulated=True, pnl=-500, opened=BASE - timedelta(days=30))
    sim_open = _trade(user, account, symbol=SIM, simulated=True, status=TradeStatus.open)
    db.add_all([live, sim_closed, sim_open])
    db.flush()
    state = SimpleNamespace(db=db, user=user, account=account, live=live, sim=sim_closed, sim_open=sim_open)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user
    state.client = TestClient(app)
    yield state
    app.dependency_overrides.clear()


def _symbols(rows) -> set[str]:
    return {r.symbol for r in rows}


def test_helper_excludes_simulated(env):
    rows = env.db.scalars(live_trades(env.user.id)).all()
    assert _symbols(rows) == {"EURUSD"}
    assert get_live_trade(env.db, env.user.id, env.sim.id) is None
    assert get_live_trade(env.db, env.user.id, env.live.id) is not None


def test_stats_service(env):
    assert _symbols(stats_service._closed_trades(env.db, env.user.id)) == {"EURUSD"}
    assert SIM not in _symbols(stats_service._open_trades(env.db, env.user.id))


def test_advanced_analytics(env):
    loaded = load(env.db, env.user, env.account.id, Filters(), "net")
    assert [v.symbol for v in loaded.current] == ["EURUSD"]


def test_trade_export(env):
    rows = trade_export._select_trades(
        env.db, env.user.id, scope="all", pnl_display_mode="net", filters=TradeExportFilters()
    )
    assert SIM not in _symbols(rows)


def test_insight_rules(env):
    assert _symbols(insight_rules._get_closed_trades(env.db, env.user.id)) == {"EURUSD"}


def test_progress_tracker_earliest_day(env):
    assert progress_tracker_service._earliest_trade_day(env.db, env.user) == date(2026, 3, 2)


def test_behavior_ignores_simulated_prior_loss(env):
    later = _trade(env.user, env.account, opened=env.sim.closed_at + timedelta(minutes=5), status=TradeStatus.open, qty=10)
    env.db.add(later)
    env.db.flush()
    behavior.apply_behavior_flags(env.db, env.user.id, later)
    assert "revenge_trading" not in (later.auto_flags or [])


def test_trades_api_list_and_detail(env):
    listed = env.client.get("/api/trades").json()
    assert SIM not in {t["symbol"] for t in listed}
    assert env.client.get(f"/api/trades/{env.sim.id}").status_code == 404
    assert env.client.get(f"/api/trades/{env.live.id}").status_code == 200


def test_accounts_counts(env):
    from app.api.routers.accounts import _trade_counts

    assert _trade_counts(env.db, env.user.id) == {env.account.id: 1}


def test_milestones_ignore_simulated(env):
    with_sim = env.client.get("/api/checkins/milestones").json()["unlocked_count"]
    env.db.delete(env.sim)
    env.db.delete(env.sim_open)
    env.db.flush()
    without_sim = env.client.get("/api/checkins/milestones").json()["unlocked_count"]
    assert with_sim == without_sim


def test_recaps_day_pnl(env):
    from app.api.routers.recaps import _compute_day_pnl

    summary = _compute_day_pnl(env.db, env.user.id, env.account.id, env.sim.closed_at.date())
    assert summary.trade_count == 0 and summary.net_pnl == 0
    live_day = _compute_day_pnl(env.db, env.user.id, env.account.id, BASE.date())
    assert live_day.trade_count == 1


SCAN_ALLOW = {
    # Writers or ownership lookups that never surface rows to a reader.
    "services/live_trades.py",
}
TRADE_READ = re.compile(r"select\(\s*Trade\b|query\(\s*Trade\b|select\(func\.\w+\(Trade|select\(Trade\.")


def test_every_trade_reader_uses_live_helper():
    root = Path(__file__).resolve().parents[1] / "app"
    offenders = []
    for path in root.rglob("*.py"):
        rel = path.relative_to(root).as_posix()
        text = path.read_text(encoding="utf-8")
        if rel in SCAN_ALLOW or not TRADE_READ.search(text):
            continue
        if not any(token in text for token in ("live_scope", "live_trades", "LIVE_TRADE_FILTER", "is_simulated")):
            offenders.append(rel)
    assert not offenders, f"Trade readers bypass services/live_trades.py: {offenders}"
