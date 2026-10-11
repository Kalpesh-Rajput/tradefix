"""API tests against the configured Postgres inside a rolled-back transaction."""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.db import get_db
from app.main import app
from app.models.account import Account
from app.models.daily_checkin import DailyCheckin
from app.models.trade import Trade, TradeStatus
from app.models.user import User
from app.services.rate_limit import advanced_analytics_limiter, analytics_drilldown_limiter


def _engine():
    try:
        engine = create_engine(settings.database_url, pool_pre_ping=True)
        with engine.connect() as conn:
            conn.execute(text("select 1"))
        return engine
    except Exception:  # pragma: no cover - environment dependent
        return None


ENGINE = _engine()
pytestmark = pytest.mark.skipif(ENGINE is None, reason="Postgres not reachable")


@pytest.fixture()
def env():
    conn = ENGINE.connect()
    tx = conn.begin()
    db = Session(bind=conn, join_transaction_mode="create_savepoint")
    owner = User(email=f"adv-{uuid4()}@test.local", name="Owner", timezone="America/New_York")
    other = User(email=f"adv-{uuid4()}@test.local", name="Other", timezone="UTC")
    db.add_all([owner, other])
    db.flush()
    acct = Account(user_id=owner.id, name="Main", initial_balance=Decimal("10000"))
    other_acct = Account(user_id=other.id, name="Theirs", initial_balance=Decimal("5000"))
    db.add_all([acct, other_acct])
    db.flush()
    base = datetime(2026, 3, 2, 14, 30, tzinfo=timezone.utc)
    pnls = [120, -60, 80, -40, 0, 150, -90, 60, -30, 45]
    for i, pnl in enumerate(pnls):
        opened = base + timedelta(days=i // 2, hours=i % 2)
        db.add(
            Trade(
                user_id=owner.id,
                account_id=acct.id,
                symbol="ES" if i % 2 == 0 else "NQ",
                quantity=1,
                entry_price=100,
                exit_price=101,
                opened_at=opened,
                closed_at=opened + timedelta(minutes=20),
                pnl=pnl,
                fees=Decimal("2.50"),
                risk_amount=50,
                status=TradeStatus.closed,
                emotion_tags=["FOMO"] if pnl < 0 else [],
                setup_tags=["ORB"],
            )
        )
    db.add(Trade(user_id=owner.id, account_id=acct.id, symbol="ES", quantity=1, entry_price=1, opened_at=base, status=TradeStatus.open))
    db.add(Trade(user_id=owner.id, account_id=acct.id, symbol="ES", quantity=1, entry_price=1, opened_at=base, closed_at=base, pnl=999, status=TradeStatus.closed, is_deleted=True))
    db.add(Trade(user_id=other.id, account_id=other_acct.id, symbol="ES", quantity=1, entry_price=1, opened_at=base, closed_at=base, pnl=777, status=TradeStatus.closed))
    db.add(DailyCheckin(user_id=owner.id, account_id=None, date=date(2026, 3, 2), followed="yes"))
    db.flush()

    state = {"user": owner}
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: state["user"]
    advanced_analytics_limiter._hits.clear()
    analytics_drilldown_limiter._hits.clear()
    client = TestClient(app)
    try:
        yield SimpleEnv(client, db, owner, other, acct, other_acct, state, pnls)
    finally:
        app.dependency_overrides.clear()
        db.close()
        tx.rollback()
        conn.close()


class SimpleEnv:
    def __init__(self, client, db, owner, other, acct, other_acct, state, pnls):
        self.client, self.db = client, db
        self.owner, self.other, self.acct, self.other_acct = owner, other, acct, other_acct
        self.state, self.pnls = state, pnls


def test_requires_auth():
    client = TestClient(app)
    assert client.get(f"/api/analytics/advanced?account_id={uuid4()}").status_code == 401
    assert client.get(f"/api/analytics/advanced/drilldown?account_id={uuid4()}&dimension=all&key=all").status_code == 401


def test_advanced_scope_and_parity(env):
    res = env.client.get(f"/api/analytics/advanced?account_id={env.acct.id}")
    assert res.status_code == 200, res.text
    body = res.json()
    s = body["summary"]
    assert s["trades"] == len(env.pnls)
    assert s["net_pnl"] == sum(env.pnls)
    assert body["meta"]["open_trades_excluded"] == 1
    assert body["meta"]["timezone"] == "America/New_York"
    assert body["score"]["sample_size"] == len(env.pnls)
    legacy = env.client.get(f"/api/analytics?account_id={env.acct.id}").json()["overview"]
    assert legacy["total_pnl"] == s["net_pnl"]
    assert legacy["win_rate"] == s["win_rate"]
    assert legacy["max_drawdown"] == s["max_drawdown"]
    assert legacy["expectancy"] == s["expectancy"]


def test_gross_mode_adds_fees_once(env):
    body = env.client.get(f"/api/analytics/advanced?account_id={env.acct.id}&pnl_mode=gross").json()
    assert body["summary"]["net_pnl"] == sum(env.pnls) + 2.5 * len(env.pnls)
    assert body["summary"]["total_fees"] == 2.5 * len(env.pnls)
    assert body["meta"]["pnl_mode"] == "gross"


def test_other_users_account_is_404(env):
    assert env.client.get(f"/api/analytics/advanced?account_id={env.other_acct.id}").status_code == 404
    assert (
        env.client.get(f"/api/analytics/advanced/drilldown?account_id={env.other_acct.id}&dimension=all&key=all").status_code
        == 404
    )
    env.state["user"] = env.other
    body = env.client.get(f"/api/analytics/advanced?account_id={env.other_acct.id}").json()
    assert body["summary"]["trades"] == 1 and body["summary"]["net_pnl"] == 777


def test_validation(env):
    base = f"/api/analytics/advanced?account_id={env.acct.id}"
    assert env.client.get(base + "&date_from=2026-03-05&date_to=2026-03-01").status_code == 422
    assert env.client.get(base + "&pnl_mode=bogus").status_code == 422
    assert env.client.get(base + "&date_from=not-a-date").status_code == 422
    drill = f"/api/analytics/advanced/drilldown?account_id={env.acct.id}"
    assert env.client.get(drill + "&dimension=drop_table&key=x").status_code == 422
    assert env.client.get(drill + "&dimension=symbol&key=" + "x" * 500).status_code == 422


def test_filters_and_drilldown_counts(env):
    base = f"account_id={env.acct.id}&date_from=2026-03-02&date_to=2026-03-04&symbol=es"
    body = env.client.get(f"/api/analytics/advanced?{base}").json()
    es_trades = [p for i, p in enumerate(env.pnls) if i % 2 == 0 and i // 2 <= 2]
    assert body["summary"]["trades"] == len(es_trades)
    assert body["meta"]["previous_from"] == "2026-02-27"
    multi = env.client.get(
        f"/api/analytics/advanced?account_id={env.acct.id}&symbol=ES&symbol=NQ"
    ).json()
    assert multi["summary"]["trades"] == len(env.pnls)

    for cell in body["timing"]["weekday_hour"]:
        d = env.client.get(f"/api/analytics/advanced/drilldown?{base}&dimension=weekday_hour&key={cell['key']}").json()
        assert d["total"] == cell["trades"] and d["summary"]["net_pnl"] == cell["net_pnl"]
    for row in body["psychology"]["emotions"]["rows"]:
        d = env.client.get(f"/api/analytics/advanced/drilldown?{base}&dimension=emotion&key={row['key']}").json()
        assert d["total"] == row["trades"]
    checkin = {r["key"]: r for r in body["discipline"]["checkins"]}
    d = env.client.get(f"/api/analytics/advanced/drilldown?{base}&dimension=checkin&key=yes").json()
    assert d["total"] == checkin["yes"]["trades"] > 0


def test_drilldown_limit_reports_truncation(env):
    d = env.client.get(f"/api/analytics/advanced/drilldown?account_id={env.acct.id}&dimension=all&key=all&limit=3").json()
    assert d["total"] == len(env.pnls) and d["returned"] == 3 and d["truncated"] is True
    assert d["summary"]["trades"] == len(env.pnls)
    assert d["rows"][0]["opened_at"] >= d["rows"][-1]["opened_at"]


def test_rate_limit_shared_across_requests(env, monkeypatch):
    monkeypatch.setattr(advanced_analytics_limiter, "max_calls", 2)
    url = f"/api/analytics/advanced?account_id={env.acct.id}"
    assert env.client.get(url).status_code == 200
    assert env.client.get(url).status_code == 200
    assert env.client.get(url).status_code == 429
