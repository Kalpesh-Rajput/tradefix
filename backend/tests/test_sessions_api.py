"""Manual session persistence, verification and the session replay descriptor (backtesting 3C)."""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.db import get_db
from app.main import app
from app.models.backtest import SessionOrder, SessionTrade
from app.models.trade import Trade
from app.schemas.market_data import InstrumentOut
from app.schemas.replay import AlignmentOut, ReplayPayload, ReplayTradeOut, TimeBasisOut
from app.services.backtest import sessions_service
from tests.bt_support import db, make_account, make_user, requires_db  # noqa: F401

pytestmark = requires_db

START = 1_700_000_000_000
END = START + 3_600_000


def _ready(descriptor, **_kw):
    return ReplayPayload(
        status="ready",
        source="session",
        trade_ref=descriptor.trade_ref,
        instrument=InstrumentOut(
            symbol="BTCUSDT",
            asset_class="crypto",
            source="binance",
            market_type="spot",
            pip_size=0.01,
            contract_size=1,
            quote_currency="USDT",
            price_decimals=2,
            enabled=True,
        ),
        trade=ReplayTradeOut(
            side=descriptor.side,
            size=descriptor.size,
            entry_ms=descriptor.entry_ms,
            entry_price=descriptor.entry_price,
            exit_ms=descriptor.exit_ms,
            exit_price=descriptor.exit_price,
            stop_loss=descriptor.stop_loss,
            take_profit=descriptor.take_profit,
            fees=descriptor.fees,
        ),
        default_timeframe="1m",
        suggested_start_ms=START,
        window_start_ms=START,
        window_end_ms=END,
        alignment=AlignmentOut(tolerance=0.01),
        time_basis=TimeBasisOut(basis="utc_aware", rule="utc_aware"),
    )


@pytest.fixture()
def env(db, monkeypatch):  # noqa: F811
    monkeypatch.setattr(sessions_service, "covered_ranges", lambda *_a, **_k: [(0, 9_000_000_000_000)])
    monkeypatch.setattr(sessions_service, "default_bars", lambda _spec: (lambda _t: (0.0, 1_000_000.0)))
    user = make_user(db)
    account = make_account(db, user)
    holder = {"user": user}
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: holder["user"]
    try:
        yield db, user, account, holder, TestClient(app)
    finally:
        app.dependency_overrides.clear()


def _create(client: TestClient, **kw) -> dict:
    body = {
        "symbol": "BTCUSDT",
        "timeframe": "1m",
        "start_ms": START,
        "end_ms": END,
        "initial_balance": 10000,
        "spread_pips": 0,
        "commission_per_lot": 0,
    }
    body.update(kw)
    response = client.post("/api/backtest/sessions", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def _trade(trade_id: uuid.UUID | None = None, **kw) -> dict:
    body = {
        "id": str(trade_id or uuid.uuid4()),
        "side": "buy",
        "size": 1,
        "entry_ms": START + 60_000,
        "entry_price": 100,
        "exit_ms": START + 120_000,
        "exit_price": 110,
        "sl": 90,
        "tp": 120,
        "exit_reason": "tp",
        "client_pnl": 10,
    }
    body.update(kw)
    return body


def _order(order_id: uuid.UUID | None = None, **kw) -> dict:
    body = {
        "id": str(order_id or uuid.uuid4()),
        "side": "buy",
        "order_type": "limit",
        "size": 1,
        "price": 100,
        "status": "pending",
        "created_ms": START + 30_000,
    }
    body.update(kw)
    return body


def test_batches_are_idempotent_and_values_are_recomputed(env):
    db, _user, _account, _holder, client = env
    session = _create(client)
    order = _order()
    first = client.post(f"/api/backtest/sessions/{session['id']}/orders", json={"orders": [order]})
    second = client.post(f"/api/backtest/sessions/{session['id']}/orders", json={"orders": [order, order]})
    assert first.status_code == 200 and second.status_code == 200
    session_id = uuid.UUID(session["id"])
    assert db.query(SessionOrder).filter(SessionOrder.session_id == session_id).count() == 1

    trade_id = uuid.uuid4()
    honest = _trade(trade_id)
    lying = _trade(trade_id, client_pnl=999)
    saved = client.post(f"/api/backtest/sessions/{session['id']}/trades", json={"trades": [honest]})
    again = client.post(f"/api/backtest/sessions/{session['id']}/trades", json={"trades": [lying]})
    assert saved.status_code == 200, saved.text
    assert again.status_code == 200
    assert db.query(SessionTrade).filter(SessionTrade.session_id == session_id).count() == 1
    row = saved.json()[0]
    assert row["pnl"] == pytest.approx(10)
    assert row["pips"] == pytest.approx(1000)
    assert row["r_multiple"] == pytest.approx(1)
    assert row["discrepancy"] is False
    flagged = client.post(
        f"/api/backtest/sessions/{session['id']}/trades",
        json={"trades": [_trade(client_pnl=999)]},
    )
    assert flagged.json()[0]["pnl"] == pytest.approx(10)
    assert flagged.json()[0]["discrepancy"] is True
    detail = client.get(f"/api/backtest/sessions/{session['id']}").json()
    assert any("recomputed" in warning for warning in detail["warnings"])
    assert detail["stats"]["net_profit"] == pytest.approx(20)
    assert detail["stats"]["balance"] == pytest.approx(10020)


def test_rejects_out_of_window_and_out_of_candle(env, monkeypatch):
    _db, _user, _account, _holder, client = env
    session = _create(client)
    outside = client.post(
        f"/api/backtest/sessions/{session['id']}/trades",
        json={"trades": [_trade(entry_ms=START - 1)]},
    )
    assert outside.status_code == 422 and outside.json()["code"] == "invalid_request"

    def tight(_time_ms):
        return (100.0, 110.0)

    monkeypatch.setattr(sessions_service, "default_bars", lambda _spec: tight)
    price = client.post(
        f"/api/backtest/sessions/{session['id']}/trades",
        json={"trades": [_trade(entry_price=50)]},
    )
    assert price.status_code == 422 and price.json()["code"] == "invalid_request"

    monkeypatch.setattr(sessions_service, "default_bars", lambda _spec: (lambda _t: None))
    missing = client.post(
        f"/api/backtest/sessions/{session['id']}/trades",
        json={"trades": [_trade()]},
    )
    assert missing.status_code == 503 and missing.json()["code"] == "data_unavailable"


def test_finish_is_idempotent_and_delete_cascades(env):
    db, _user, _account, _holder, client = env
    session = _create(client)
    client.post(f"/api/backtest/sessions/{session['id']}/orders", json={"orders": [_order()]})
    client.post(f"/api/backtest/sessions/{session['id']}/trades", json={"trades": [_trade()]})
    first = client.post(f"/api/backtest/sessions/{session['id']}/finish")
    second = client.post(f"/api/backtest/sessions/{session['id']}/finish")
    assert first.status_code == 200 and second.status_code == 200
    assert first.json()["status"] == "finished" and second.json()["stats"] == first.json()["stats"]
    session_id = uuid.UUID(session["id"])
    assert client.delete(f"/api/backtest/sessions/{session['id']}").status_code == 204
    assert client.get(f"/api/backtest/sessions/{session['id']}").status_code == 404
    assert db.query(SessionOrder).filter(SessionOrder.session_id == session_id).count() == 0
    assert db.query(SessionTrade).filter(SessionTrade.session_id == session_id).count() == 0


def test_quota(env, monkeypatch):
    _db, _user, _account, _holder, client = env
    monkeypatch.setattr(settings, "backtest_max_sessions", 1)
    _create(client)
    blocked = client.post(
        "/api/backtest/sessions",
        json={"symbol": "BTCUSDT", "timeframe": "1m", "start_ms": START, "initial_balance": 1000},
    )
    assert blocked.status_code == 429 and blocked.json()["code"] == "quota_exceeded"


def test_start_must_be_inside_coverage(env, monkeypatch):
    _db, _user, _account, _holder, client = env
    monkeypatch.setattr(sessions_service, "covered_ranges", lambda *_a, **_k: [])
    response = client.post(
        "/api/backtest/sessions",
        json={"symbol": "BTCUSDT", "timeframe": "1m", "start_ms": START, "initial_balance": 1000},
    )
    assert response.status_code == 422 and response.json()["code"] == "range_outside_available_data"


def test_descriptor_is_owner_scoped(env, monkeypatch):
    db, user, _account, holder, client = env
    seen = {}

    def capture(db_, descriptor):
        seen["descriptor"] = descriptor
        seen["user"] = descriptor.user_id
        return _ready(descriptor)

    monkeypatch.setattr(sessions_service, "build_replay_payload", capture)
    session = _create(client)
    trade_id = uuid.uuid4()
    client.post(f"/api/backtest/sessions/{session['id']}/trades", json={"trades": [_trade(trade_id, side="sell", exit_price=90)]})
    owned = client.get(f"/api/backtest/sessions/{session['id']}/trades/{trade_id}/replay")
    assert owned.status_code == 200, owned.text
    assert owned.json()["source"] == "session"
    assert seen["descriptor"].side == "short"
    assert seen["user"] == user.id
    missing = client.get(f"/api/backtest/sessions/{session['id']}/trades/{uuid.uuid4()}/replay")
    assert missing.status_code == 404
    holder["user"] = make_user(db)
    foreign = client.get(f"/api/backtest/sessions/{session['id']}/trades/{trade_id}/replay")
    assert foreign.status_code == 404


def test_save_to_journal_marks_simulated(env):
    db, user, account, _holder, client = env
    session = _create(client, account_id=str(account.id))
    trade_id = uuid.uuid4()
    client.post(f"/api/backtest/sessions/{session['id']}/trades", json={"trades": [_trade(trade_id)]})
    saved = client.post(
        f"/api/backtest/sessions/{session['id']}/trades/{trade_id}/journal",
        json={"account_id": str(account.id)},
    )
    assert saved.status_code == 201, saved.text
    journal = db.get(Trade, uuid.UUID(saved.json()["trade_id"]))
    assert journal is not None
    assert journal.is_simulated is True
    assert journal.time_basis == "utc_aware"
    assert journal.user_id == user.id
