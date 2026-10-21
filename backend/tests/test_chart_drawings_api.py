"""Chart drawing persistence: validation, idempotent sync, ownership isolation."""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.core.db import get_db
from app.main import app
from tests.bt_support import db, make_user, requires_db  # noqa: F401

pytestmark = requires_db

WORKSPACE = "session:test"


@pytest.fixture()
def env(db):  # noqa: F811
    first = make_user(db)
    second = make_user(db)
    holder = {"user": first}
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: holder["user"]
    try:
        yield holder, first, second, TestClient(app)
    finally:
        app.dependency_overrides.clear()


def _drawing(**kw) -> dict:
    body = {
        "id": str(uuid.uuid4()),
        "tool": "trendline",
        "symbol": "EURUSD",
        "timeframe": "1m",
        "anchors": [{"time_ms": 1_700_000_000_000, "price": 1.1}, {"time_ms": 1_700_000_600_000, "price": 1.2}],
        "style": {"color": "#4f46e5", "width": 2},
        "props": {},
    }
    body.update(kw)
    return body


def _sync(client, upserts=(), deletes=(), workspace=WORKSPACE):
    return client.post("/api/chart-drawings/sync", json={"workspace": workspace, "upserts": list(upserts), "deletes": list(deletes)})


def _list(client, workspace=WORKSPACE, symbol="EURUSD"):
    return client.get("/api/chart-drawings", params={"workspace": workspace, "symbol": symbol})


def test_save_restore_update_delete(env):
    _, _, _, client = env
    item = _drawing()
    assert _sync(client, [item]).json() == {"saved": 1, "deleted": 0}
    rows = _list(client).json()
    assert len(rows) == 1 and rows[0]["anchors"][1]["price"] == 1.2
    item["anchors"][1]["price"] = 1.3
    item["locked"] = True
    assert _sync(client, [item]).status_code == 200
    rows = _list(client).json()
    assert len(rows) == 1 and rows[0]["anchors"][1]["price"] == 1.3 and rows[0]["locked"] is True
    assert _sync(client, deletes=[item["id"]]).json()["deleted"] == 1
    assert _list(client).json() == []


def test_sync_is_idempotent(env):
    _, _, _, client = env
    item = _drawing()
    for _ in range(3):
        assert _sync(client, [item]).status_code == 200
    assert len(_list(client).json()) == 1


def test_other_user_cannot_read_or_touch_drawings(env):
    holder, _, second, client = env
    item = _drawing()
    _sync(client, [item])
    holder["user"] = second
    assert _list(client).json() == []
    assert _sync(client, deletes=[item["id"]]).status_code == 404
    assert _sync(client, [{**item, "anchors": []}]).status_code == 404
    assert client.delete("/api/chart-drawings", params={"workspace": WORKSPACE, "symbol": "EURUSD"}).json() == {"deleted": 0}


def test_cannot_attach_to_foreign_session(env):
    _, _, _, client = env
    body = {"workspace": "session:x", "session_id": str(uuid.uuid4()), "upserts": [_drawing()], "deletes": []}
    assert client.post("/api/chart-drawings/sync", json=body).status_code == 404


def test_invalid_payloads_rejected(env):
    _, _, _, client = env
    assert _sync(client, [_drawing(tool="not_a_tool")]).status_code == 422
    assert _sync(client, [_drawing(anchors=[{"time_ms": -1, "price": 1}])]).status_code == 422
    assert _sync(client, [_drawing(anchors=[{"time_ms": 1, "price": 1}] * 13)]).status_code == 422
    assert _sync(client, [_drawing(props={"blob": "x" * 9000})]).status_code == 422
    assert _sync(client, [_drawing(id="nope")]).status_code == 422


def test_clear_only_matching_symbol(env):
    _, _, _, client = env
    _sync(client, [_drawing(), _drawing(symbol="GBPUSD")])
    assert client.delete("/api/chart-drawings", params={"workspace": WORKSPACE, "symbol": "EURUSD"}).json() == {"deleted": 1}
    assert len(_list(client, symbol="GBPUSD").json()) == 1
