"""Admin data status, backfill, retry, aliases and unresolved symbols."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.core.db import get_db
from app.main import app
from app.models.job import Job
from app.services.marketdata.resolver import record_unresolved
from tests.bt_support import db, make_user, requires_db  # noqa: F401

pytestmark = requires_db


@pytest.fixture()
def client(db):  # noqa: F811
    admin = make_user(db, role="admin")
    trader = make_user(db)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: admin
    try:
        yield db, admin, trader, TestClient(app)
    finally:
        app.dependency_overrides.clear()


def test_non_admin_is_forbidden(client):
    _db, _admin, trader, http = client
    app.dependency_overrides[get_current_user] = lambda: trader
    assert http.get("/api/admin/data-status").status_code == 403
    assert http.get("/api/admin/time-offsets").status_code == 403
    assert http.post("/api/admin/backfill", json={"symbol": "BTCUSDT", "start_ms": 0, "end_ms": 60_000}).status_code == 403


def test_status_backfill_alias_retry_and_unresolved(client):
    db, admin, _trader, http = client
    app.dependency_overrides[get_current_user] = lambda: admin
    status = http.get("/api/admin/data-status")
    assert status.status_code == 200
    symbols = {row["symbol"] for row in status.json()["instruments"]}
    assert "BTCUSDT" in symbols

    failed = Job(type="candles.ingest", lane="binance", status="failed", payload={"symbol": "BTCUSDT"}, error_code="rate_limited", error_message="slow down")
    db.add(failed)
    db.commit()
    listed = http.get("/api/admin/data-status")
    assert any(row["id"] == str(failed.id) for row in listed.json()["failures"])

    retried = http.post(f"/api/admin/jobs/{failed.id}/retry")
    assert retried.status_code == 200 and retried.json()["status"] == "queued"

    backfill = http.post("/api/admin/backfill", json={"symbol": "BTCUSDT", "start_ms": 1_700_000_000_000, "end_ms": 1_700_000_060_000})
    assert backfill.status_code == 201 and backfill.json()["job_id"]
    assert http.post("/api/admin/backfill", json={"symbol": "NOTREAL", "start_ms": 0, "end_ms": 60_000}).status_code == 422

    created = http.post("/api/admin/aliases", json={"broker": "desk", "raw_symbol": "BTC-USD", "canonical": "BTCUSDT"})
    assert created.status_code == 201, created.text
    alias_id = created.json()["id"]
    assert any(row["id"] == alias_id for row in http.get("/api/admin/aliases").json())
    assert http.delete(f"/api/admin/aliases/{alias_id}").status_code == 204

    record_unresolved(db, "desk", "WEIRD")
    db.commit()
    unresolved = http.get("/api/admin/unresolved")
    assert unresolved.status_code == 200
    assert any(row["raw_symbol"] == "WEIRD" for row in unresolved.json())
    assert http.get("/api/admin/time-offsets").status_code == 200
