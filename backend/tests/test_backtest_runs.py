"""Run jobs: cancel, time limit, bar cap, concurrency, quota, cache, and the replay descriptor."""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.db import get_db
from app.main import app
from app.models.job import Job
from app.schemas.market_data import InstrumentOut
from app.schemas.replay import AlignmentOut, ReplayPayload, ReplayTradeOut, TimeBasisOut
from app.services.backtest import runs_service, strategies_service
from app.services.backtest.errors import BacktestError
from app.services.backtest.rules import Bar
from app.services.jobs.queue import JobCancelled, JobContext
from tests.bt_support import db, make_user, requires_db  # noqa: F401

pytestmark = requires_db


def _body():
    return {
        "definition": {
            "schema_version": 1,
            "name": "close above",
            "market": {"symbol": "BTCUSDT", "timeframe": "1h", "start_ms": 0, "end_ms": 3_600_000},
            "direction": "long",
            "long_entry": {
                "combine": "all",
                "conditions": [
                    {"left": {"kind": "price", "field": "close"}, "operator": "gt", "right": {"kind": "constant", "value": 10}}
                ],
            },
            "stop_loss": {"type": "pips", "value": 100000},
            "take_profit": {"type": "pips", "value": 100000},
            "risk": {"initial_balance": 10000, "fixed_size": 1},
            "costs": {"spread_pips": 0, "commission_per_lot": 0, "slippage_pips": 0},
        }
    }


def _bars(*closes: float) -> list[Bar]:
    return [Bar(index * 3_600_000, close, close + 1, close - 1, close) for index, close in enumerate(closes)]


@pytest.fixture()
def env(db, monkeypatch):  # noqa: F811
    monkeypatch.setattr(strategies_service, "covered_ranges", lambda *_a, **_k: [(0, 9_000_000_000_000)])
    monkeypatch.setattr(runs_service, "await_market_data", lambda *_a, **_k: None)
    monkeypatch.setattr(settings, "backtest_min_bars", 0)
    monkeypatch.setattr(runs_service, "load_bars", lambda *_a, **_k: _bars(9, 12, 13, 14))
    user = make_user(db)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        yield db, user, TestClient(app)
    finally:
        app.dependency_overrides.clear()


def _run(db, client: TestClient) -> dict:
    response = client.post("/api/backtests", json=_body())
    assert response.status_code == 201, response.text
    return response.json()


def _execute(db, run_id: str):
    from app.models.backtest import BacktestRun

    run = db.get(BacktestRun, uuid.UUID(run_id))
    job = db.get(Job, run.job_id)
    return runs_service.execute(JobContext(db=db, job=job, worker_id="test"))


def test_execute_cache_and_descriptor(env, monkeypatch):
    db, user, client = env
    created = _run(db, client)
    assert _execute(db, created["id"])["status"] == "succeeded"
    detail = client.get(f"/api/backtests/{created['id']}")
    assert detail.status_code == 200
    assert detail.json()["status"] == "succeeded"
    trades = client.get(f"/api/backtests/{created['id']}/trades", params={"side": "buy", "limit": 10, "offset": 0})
    assert trades.status_code == 200 and trades.json()["total"] >= 1
    assert client.get(f"/api/backtests/{created['id']}/trades", params={"side": "sell"}).json()["total"] == 0

    cached = client.post("/api/backtests", json=_body())
    assert cached.status_code == 201
    assert cached.json()["status"] == "succeeded"
    assert cached.json()["id"] != created["id"]
    assert cached.json()["metrics"] == detail.json()["metrics"]

    def ready(db_, descriptor):
        return ReplayPayload(
            status="ready",
            source="run",
            trade_ref=descriptor.trade_ref,
            instrument=InstrumentOut(
                symbol="BTCUSDT", asset_class="crypto", source="binance", market_type="spot",
                pip_size=0.01, contract_size=1, quote_currency="USDT", price_decimals=2, enabled=True,
            ),
            trade=ReplayTradeOut(
                side=descriptor.side, size=descriptor.size, entry_ms=descriptor.entry_ms, entry_price=descriptor.entry_price,
                exit_ms=descriptor.exit_ms, exit_price=descriptor.exit_price, stop_loss=descriptor.stop_loss,
                take_profit=descriptor.take_profit, fees=None,
            ),
            default_timeframe="1h",
            suggested_start_ms=0,
            window_start_ms=0,
            window_end_ms=1,
            alignment=AlignmentOut(tolerance=0.01),
            time_basis=TimeBasisOut(basis="utc_aware", rule="utc_aware"),
        )

    monkeypatch.setattr(runs_service, "build_replay_payload", ready)
    seq = trades.json()["trades"][0]["seq"]
    owned = client.get(f"/api/backtests/{created['id']}/trades/{seq}/replay")
    assert owned.status_code == 200 and owned.json()["source"] == "run"
    other = make_user(db)
    app.dependency_overrides[get_current_user] = lambda: other
    assert client.get(f"/api/backtests/{created['id']}/trades/{seq}/replay").status_code == 404
    app.dependency_overrides[get_current_user] = lambda: user
    assert client.get(f"/api/backtests/{created['id']}/trades/999/replay").status_code == 404
    assert client.get(f"/api/backtests/{uuid.uuid4()}/trades/1/replay").status_code == 404


def test_cancel_time_limit_bar_cap_and_quota(env, monkeypatch):
    db, _user, client = env
    monkeypatch.setattr(settings, "backtest_max_concurrent_per_user", 10)
    created = _run(db, client)
    from app.models.backtest import BacktestRun

    run = db.get(BacktestRun, uuid.UUID(created["id"]))
    job = db.get(Job, run.job_id)
    job.cancel_requested = True
    db.flush()
    with pytest.raises(JobCancelled):
        runs_service.execute(JobContext(db=db, job=job, worker_id="test"))

    monkeypatch.setattr(settings, "backtest_max_bars_per_run", 10**9)
    wide = _body()
    wide["definition"]["market"]["end_ms"] = 10 * 3_600_000
    wide["definition"]["name"] = "wide"
    queued = client.post("/api/backtests", json=wide)
    assert queued.status_code == 201, queued.text
    monkeypatch.setattr(settings, "backtest_max_bars_per_run", 0)
    with pytest.raises(BacktestError) as capped:
        _execute(db, queued.json()["id"])
    assert capped.value.code == "limit_exceeded"

    monkeypatch.setattr(settings, "backtest_max_bars_per_run", 10**9)
    monkeypatch.setattr(settings, "backtest_time_limit_s", -1)
    timed_body = _body()
    timed_body["definition"] = {**timed_body["definition"], "name": "timed", "market": {**timed_body["definition"]["market"], "end_ms": 7_200_000}}
    timed = client.post("/api/backtests", json=timed_body)
    assert timed.status_code == 201, timed.text
    with pytest.raises(BacktestError) as slow:
        _execute(db, timed.json()["id"])
    assert slow.value.code == "job_failed"

    monkeypatch.setattr(settings, "backtest_time_limit_s", 120)
    monkeypatch.setattr(settings, "backtest_max_concurrent_per_user", 0)
    busy = client.post("/api/backtests", json=_body())
    assert busy.status_code == 429 and "already have a backtest running" in busy.json()["message"]
    monkeypatch.setattr(settings, "backtest_max_concurrent_per_user", 10)
    monkeypatch.setattr(settings, "backtest_runs_per_day", 0)
    blocked = client.post("/api/backtests", json=_body())
    assert blocked.status_code == 429 and "today" in blocked.json()["message"]
    from app.models.backtest import UsageCounter
    from datetime import date

    counter = db.get(UsageCounter, (_user.id, date.today()))
    counter.backtest_runs = 0
    db.flush()
    monkeypatch.setattr(settings, "backtest_runs_per_day", 30)
    reset_body = _body()
    reset_body["definition"] = {**reset_body["definition"], "name": "after reset", "market": {**reset_body["definition"]["market"], "end_ms": 14_400_000}}
    reset = client.post("/api/backtests", json=reset_body)
    assert reset.status_code == 201, reset.text
