"""Strategy runs load stored candles, wait for missing data, and refuse an empty result.

The expected trade is hand-computed, not taken from the engine:

- 80 one-minute bars, open = close = 100 + i, high = close + 1, low = close - 1.
- The rule is close > 100. Bar 0 (close 100) does not qualify, and bar 0 cannot signal.
- The first signal is bar 1 (close 101). A market order fills at the next open, bar 2, price 102.
- The stop and target are 100,000 pips away (1,000 price), so neither is touched.
- The position closes at the last close, bar 79, price 179. Size is 1 and costs are 0.
- Profit is 179 - 102 = 77.
"""

from __future__ import annotations

from concurrent.futures import Future

from sqlalchemy import delete, update
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.db import get_db
from app.main import app
from app.models.backtest import BacktestRun
from app.models.job import Job
from app.models.market_data import CandleCoverage
from app.services.backtest import runs_service
from app.services.jobs import queue
from app.services.marketdata.cache import candle_cache
from app.services.marketdata.candles import MINUTE_MS, Candles
from app.services.marketdata.coverage import record_fetch
from app.services.marketdata.providers.base import Chunk, ProviderError
from app.services.marketdata.registry import get_instrument, mirror_to_db
from app.services.marketdata.store import LocalParquetStore
from app.workers.market_worker import MarketWorker
from tests.bt_support import db, make_user, requires_db  # noqa: F401

pytestmark = requires_db

T0 = int(datetime(2024, 6, 3, tzinfo=timezone.utc).timestamp() * 1000)
COUNT = 80


def _rows(count: int = COUNT) -> Candles:
    return Candles.from_rows(
        (T0 + index * MINUTE_MS, 100 + index, 101 + index, 99 + index, 100 + index, 1) for index in range(count)
    )


def _body(**market):
    window = {"symbol": "BTCUSDT", "timeframe": "1m", "start_ms": T0, "end_ms": T0 + COUNT * MINUTE_MS}
    window.update(market)
    return {
        "definition": {
            "schema_version": 1,
            "name": "close above 100",
            "market": window,
            "direction": "long",
            "long_entry": {
                "combine": "all",
                "conditions": [
                    {"left": {"kind": "price", "field": "close"}, "operator": "gt", "right": {"kind": "constant", "value": 100}}
                ],
            },
            "stop_loss": {"type": "pips", "value": 100000},
            "take_profit": {"type": "pips", "value": 100000},
            "risk": {"initial_balance": 10000, "fixed_size": 1},
            "costs": {"spread_pips": 0, "commission_per_lot": 0, "slippage_pips": 0},
        }
    }


class _Session:
    """Hands the test's session to the worker and ignores close(), so the rollback fixture still owns it."""

    def __init__(self, session) -> None:
        self._session = session

    def __call__(self):
        return self

    def close(self) -> None:
        return None

    def __getattr__(self, name):
        return getattr(self._session, name)


class _Inline:
    def submit(self, fn, *args, **kwargs):
        fn(*args, **kwargs)
        future: Future = Future()
        future.set_result(None)
        return future

    def shutdown(self, wait=True, cancel_futures=False) -> None:
        return None


class _Provider:
    def __init__(self, candles: Candles | None = None, fail: bool = False) -> None:
        self.candles = candles if candles is not None else Candles.empty()
        self.fail = fail
        self.calls = 0

    def iter_chunks(self, spec, start_ms, end_ms):
        self.calls += 1
        if self.fail:
            raise ProviderError("provider_failed", "recorded provider failure", retryable=False)
        yield Chunk(start_ms, end_ms, self.candles.between(start_ms, end_ms), "fake")


@pytest.fixture()
def env(db, tmp_path, monkeypatch):  # noqa: F811
    mirror_to_db(db)
    db.execute(
        delete(CandleCoverage).where(
            CandleCoverage.instrument == "BTCUSDT",
            CandleCoverage.covered_to > T0,
            CandleCoverage.covered_from < T0 + COUNT * MINUTE_MS,
        )
    )
    horizon = datetime(2099, 1, 1, tzinfo=timezone.utc)
    db.execute(update(Job).where(Job.status.in_(("queued", "running"))).values(next_run_at=horizon, locked_until=horizon))
    db.commit()
    candle_cache.invalidate("binance", "BTCUSDT", T0, T0 + COUNT * MINUTE_MS)
    store = LocalParquetStore(tmp_path)
    monkeypatch.setattr("app.services.marketdata.candle_service.get_store", lambda: store)
    monkeypatch.setattr("app.services.marketdata.ingest_jobs.get_store", lambda: store)
    monkeypatch.setattr(settings, "candle_max_bars_per_request", 40)
    monkeypatch.setattr(settings, "backtest_data_poll_s", 3600)
    monkeypatch.setattr(settings, "jobs_max_concurrent_binance", 0)
    user = make_user(db)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user
    holder = _Session(db)
    worker = MarketWorker(session_factory=holder)
    worker.pool.shutdown(wait=False, cancel_futures=True)
    worker.pool = _Inline()
    calls = {"n": 0}
    real = runs_service.load_bars

    def counted(*args, **kwargs):
        calls["n"] += 1
        return real(*args, **kwargs)

    monkeypatch.setattr(runs_service, "load_bars", counted)
    try:
        yield db, store, worker, TestClient(app), calls
    finally:
        app.dependency_overrides.clear()


def _tick(db, worker: MarketWorker) -> None:
    worker.tick()
    db.expire_all()


def _release(db, run_id: str) -> None:
    run = db.get(BacktestRun, run_id)
    job = db.get(Job, run.job_id)
    job.next_run_at = queue.utcnow() - timedelta(seconds=1)
    db.commit()


def test_worker_uses_stored_parquet_and_matches_the_hand_result(env, monkeypatch):
    db, store, worker, client, calls = env
    monkeypatch.setattr(settings, "jobs_max_concurrent_binance", 2)
    record_fetch(db, store, get_instrument("BTCUSDT"), T0, T0 + COUNT * MINUTE_MS, _rows())
    db.commit()
    created = client.post("/api/backtests", json=_body())
    assert created.status_code == 201, created.text
    _tick(db, worker)
    detail = client.get(f"/api/backtests/{created.json()['id']}")
    assert detail.status_code == 200, detail.text
    body = detail.json()
    assert body["status"] == "succeeded", body
    assert body["bars_processed"] == COUNT
    assert body["first_bar_ms"] == T0
    assert body["last_bar_ms"] == T0 + (COUNT - 1) * MINUTE_MS
    assert body["coverage_version"]
    trades = client.get(f"/api/backtests/{created.json()['id']}/trades")
    assert trades.json()["total"] == 1
    trade = trades.json()["trades"][0]
    assert trade["entry_price"] == pytest.approx(102)
    assert trade["exit_price"] == pytest.approx(179)
    assert trade["pnl"] == pytest.approx(77)
    assert calls["n"] >= 1


def test_chunked_load_concatenates_past_the_request_cap(env, monkeypatch):
    db, store, _worker, _client, _calls = env
    record_fetch(db, store, get_instrument("BTCUSDT"), T0, T0 + COUNT * MINUTE_MS, _rows())
    db.commit()
    seen = {"n": 0}
    from app.services.backtest import bar_loader

    real = bar_loader.get_candles

    def wrapped(*args, **kwargs):
        seen["n"] += 1
        return real(*args, **kwargs)

    monkeypatch.setattr(bar_loader, "get_candles", wrapped)
    loaded = bar_loader.load_strategy_bars(db, get_instrument("BTCUSDT"), "1m", T0, T0 + COUNT * MINUTE_MS, warmup_bars=0)
    assert seen["n"] == 2
    assert len(loaded.bars) == COUNT
    assert loaded.bars[0].time == T0
    assert loaded.bars[-1].close == pytest.approx(179)


def test_missing_coverage_waits_then_runs_when_the_provider_fills(env, monkeypatch):
    db, _store, worker, client, _calls = env
    provider = _Provider(_rows())
    monkeypatch.setattr("app.services.marketdata.ingest_jobs.get_provider", lambda source, throttle=None: provider)
    created = client.post("/api/backtests", json=_body())
    assert created.status_code == 201, created.text
    run_id = created.json()["id"]
    _tick(db, worker)
    waiting = client.get(f"/api/backtests/{run_id}").json()
    assert waiting["status"] == "waiting_data"
    assert waiting["data_job"]["status"] == "queued"
    monkeypatch.setattr(settings, "jobs_max_concurrent_binance", 2)
    _tick(db, worker)
    assert provider.calls == 1
    assert client.get(f"/api/backtests/{run_id}").json()["status"] == "waiting_data"
    _release(db, run_id)
    _tick(db, worker)
    done = client.get(f"/api/backtests/{run_id}").json()
    assert done["status"] == "succeeded", done
    assert done["bars_processed"] == COUNT
    assert client.get(f"/api/backtests/{run_id}/trades").json()["total"] == 1


def test_provider_failure_fails_the_run_as_data_unavailable(env, monkeypatch):
    db, _store, worker, client, _calls = env
    provider = _Provider(fail=True)
    monkeypatch.setattr("app.services.marketdata.ingest_jobs.get_provider", lambda source, throttle=None: provider)
    created = client.post("/api/backtests", json=_body())
    run_id = created.json()["id"]
    _tick(db, worker)
    assert client.get(f"/api/backtests/{run_id}").json()["status"] == "waiting_data"
    monkeypatch.setattr(settings, "jobs_max_concurrent_binance", 2)
    _tick(db, worker)
    assert provider.calls == 1
    _release(db, run_id)
    _tick(db, worker)
    failed = client.get(f"/api/backtests/{run_id}").json()
    assert failed["status"] == "failed"
    assert failed["error_code"] == "data_unavailable"
    assert "BTCUSDT" in failed["error_message"]
    assert "unavailable" in failed["error_message"]


def test_zero_bars_is_an_explicit_failure(env, monkeypatch):
    db, store, worker, client, _calls = env
    monkeypatch.setattr(settings, "jobs_max_concurrent_binance", 2)
    record_fetch(db, store, get_instrument("BTCUSDT"), T0, T0 + COUNT * MINUTE_MS, Candles.empty())
    db.commit()
    created = client.post("/api/backtests", json=_body())
    run_id = created.json()["id"]
    _tick(db, worker)
    failed = client.get(f"/api/backtests/{run_id}").json()
    assert failed["status"] == "failed", failed
    assert failed["error_code"] == "insufficient_data"
    assert "BTCUSDT" in failed["error_message"]
    assert "1m" in failed["error_message"]
    assert "0 bars" in failed["error_message"]


def test_cancel_while_waiting_for_data(env):
    db, _store, worker, client, _calls = env
    created = client.post("/api/backtests", json=_body())
    run_id = created.json()["id"]
    _tick(db, worker)
    assert client.get(f"/api/backtests/{run_id}").json()["status"] == "waiting_data"
    cancelled = client.post(f"/api/backtests/{run_id}/cancel")
    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["status"] == "cancelled"
    _tick(db, worker)
    again = client.get(f"/api/backtests/{run_id}").json()
    assert again["status"] == "cancelled"
    run = db.get(BacktestRun, run_id)
    assert db.get(Job, run.job_id).status == "cancelled"
