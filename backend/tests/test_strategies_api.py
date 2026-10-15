"""Strategy CRUD, the per-user cap, and validate (backtesting 4B)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.db import get_db
from app.main import app
from app.services.backtest import strategies_service
from tests.bt_support import db, make_user, requires_db  # noqa: F401

pytestmark = requires_db


def _body(**overrides):
    body = {
        "schema_version": 1,
        "name": "MA cross",
        "market": {"symbol": "BTCUSDT", "timeframe": "1h", "start_ms": 0, "end_ms": 3_600_000},
        "direction": "long",
        "long_entry": {
            "combine": "all",
            "conditions": [
                {
                    "left": {"kind": "indicator", "name": "sma", "period": 10, "output": "value"},
                    "operator": "crosses_above",
                    "right": {"kind": "indicator", "name": "sma", "period": 20, "output": "value"},
                }
            ],
        },
        "stop_loss": {"type": "pips", "value": 20},
        "take_profit": {"type": "r", "value": 2},
        "risk": {"initial_balance": 10000, "risk_percent": 1},
    }
    body.update(overrides)
    return body


@pytest.fixture()
def env(db, monkeypatch):  # noqa: F811
    monkeypatch.setattr(strategies_service, "covered_ranges", lambda *_a, **_k: [(0, 9_000_000_000_000)])
    user = make_user(db)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        yield db, user, TestClient(app)
    finally:
        app.dependency_overrides.clear()


def test_validate_reports_bars_and_field_errors(env):
    _db, _user, client = env
    ok = client.post("/api/strategies/validate", json=_body())
    assert ok.status_code == 200, ok.text
    assert ok.json()["ok"] is True
    assert ok.json()["estimated_bars"] == 1
    bad = client.post("/api/strategies/validate", json=_body(surprise=True))
    assert bad.status_code == 200
    assert bad.json()["ok"] is False
    assert bad.json()["errors"]


def test_crud_cap_and_owner(env, monkeypatch):
    db, user, client = env
    created = client.post("/api/strategies", json=_body())
    assert created.status_code == 201, created.text
    strategy_id = created.json()["id"]
    assert client.get("/api/strategies").json()[0]["id"] == strategy_id
    renamed = client.put(f"/api/strategies/{strategy_id}", json=_body(name="Renamed"))
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Renamed"
    monkeypatch.setattr(settings, "backtest_max_strategies", 1)
    blocked = client.post("/api/strategies", json=_body(name="Second"))
    assert blocked.status_code == 429
    other = make_user(db)
    app.dependency_overrides[get_current_user] = lambda: other
    assert client.get(f"/api/strategies/{strategy_id}").status_code == 404
    app.dependency_overrides[get_current_user] = lambda: user
    assert client.delete(f"/api/strategies/{strategy_id}").status_code == 204
    assert client.get(f"/api/strategies/{strategy_id}").status_code == 404
