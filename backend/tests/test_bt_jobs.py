"""Job queue, worker runtime, limiter, errors, entitlements, admin role (backtesting 1F)."""

from __future__ import annotations

import random
import threading
from contextlib import contextmanager
from datetime import timedelta

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import delete

from app.api.deps import get_current_user, require_admin
from app.core.config import settings
from app.models.job import Job, WorkerHeartbeat
from app.services.backtest.entitlements import check_feature, require_feature
from app.services.backtest.errors import BacktestError
from app.services.jobs import queue
from app.services.jobs.locks import AdvisoryLock
from app.services.jobs.provider_limiter import TokenBucket
from app.services.marketdata.providers.base import ProviderError
from app.services.user_roles import set_admin
from app.workers.market_worker import MarketWorker, execute_job, write_heartbeat
from tests.bt_support import ENGINE, db, make_user, requires_db  # noqa: F401

W = "test-worker"


@pytest.fixture()
def qdb(db):  # noqa: F811
    db.execute(delete(Job))
    db.flush()
    return db


def _enqueue(db, lane="binance", key=None, **kw):
    return queue.enqueue(db, type=kw.pop("type", "test.noop"), lane=lane, payload=kw.pop("payload", {}), dedup_key=key, **kw)


# --- queue --------------------------------------------------------------------------------------

@requires_db
def test_dedup_key_shares_one_active_job(qdb):
    first = _enqueue(qdb, key="candles:BTCUSDT:1")
    second = _enqueue(qdb, key="candles:BTCUSDT:1")
    assert first.created and not second.created and first.job.id == second.job.id
    job = queue.claim(qdb, W)
    assert _enqueue(qdb, key="candles:BTCUSDT:1").job.id == job.id
    queue.complete(qdb, job, {"rows": 1})
    third = _enqueue(qdb, key="candles:BTCUSDT:1")
    assert third.created and third.job.id != job.id
    assert _enqueue(qdb).created and _enqueue(qdb).created


@requires_db
def test_retry_with_backoff_then_fail(qdb, monkeypatch):
    monkeypatch.setattr(settings, "job_backoff_base_seconds", 10.0)
    job = _enqueue(qdb, max_attempts=2).job
    claimed = queue.claim(qdb, W)
    assert claimed.id == job.id and claimed.attempts == 1 and claimed.status == "running"
    before = queue.utcnow()
    queue.fail(qdb, claimed, "provider_unavailable", "down", rng=random.Random(1))
    assert claimed.status == "queued" and claimed.error_code == "provider_unavailable"
    delay = (claimed.next_run_at - before).total_seconds()
    assert 5.0 <= delay <= 10.5
    assert queue.claim(qdb, W) is None
    claimed = queue.claim(qdb, W, now=queue.utcnow() + timedelta(seconds=11))
    assert claimed.attempts == 2
    queue.fail(qdb, claimed, "provider_unavailable", "still down")
    assert claimed.status == "failed" and claimed.finished_at is not None


@requires_db
def test_non_retryable_and_retry_after(qdb):
    job = _enqueue(qdb).job
    queue.fail(qdb, queue.claim(qdb, W), "region_blocked", "451", retryable=False)
    assert job.status == "failed"
    _enqueue(qdb)
    claimed = queue.claim(qdb, W)
    queue.fail(qdb, claimed, "rate_limited", "429", retry_after_s=600)
    assert (claimed.next_run_at - queue.utcnow()).total_seconds() > 590


def test_backoff_is_capped_and_jittered(monkeypatch):
    monkeypatch.setattr(settings, "job_backoff_base_seconds", 15.0)
    monkeypatch.setattr(settings, "job_backoff_max_seconds", 900.0)
    rng = random.Random(7)
    values = [queue.backoff_seconds(n, rng=rng) for n in range(1, 12)]
    assert 7.5 <= values[0] <= 15 and 15 <= values[1] <= 30
    assert all(v <= 900 for v in values) and values[-1] >= 450


@requires_db
def test_expired_lock_is_recovered(qdb):
    job = _enqueue(qdb, max_attempts=2).job
    queue.claim(qdb, W)
    job.locked_until = queue.utcnow() - timedelta(seconds=1)
    qdb.commit()
    assert queue.recover_expired(qdb) == 1
    assert job.status == "queued" and job.locked_by is None
    queue.claim(qdb, W)
    job.locked_until = queue.utcnow() - timedelta(seconds=1)
    qdb.commit()
    queue.recover_expired(qdb)
    assert job.status == "failed" and job.error_code == "lock_expired"


@requires_db
def test_progress_extends_lock_and_reports_cancel(qdb):
    job = _enqueue(qdb).job
    queue.claim(qdb, W)
    job.locked_until = queue.utcnow() + timedelta(seconds=5)
    qdb.commit()
    assert queue.set_progress(qdb, job.id, W, 40, "month 2/5") is False
    qdb.refresh(job)
    assert job.progress == 40 and job.progress_message == "month 2/5"
    assert job.locked_until > queue.utcnow() + timedelta(seconds=settings.job_lock_seconds - 5)
    queue.request_cancel(qdb, job.id)
    assert queue.set_progress(qdb, job.id, W, 60) is True


@requires_db
def test_cancel_queued_immediately(qdb):
    job = _enqueue(qdb).job
    queue.request_cancel(qdb, job.id)
    assert job.status == "cancelled"
    assert queue.claim(qdb, W) is None


@requires_db
def test_cancellation_between_chunks(qdb):
    processed: list[int] = []

    @queue.register_handler("test.chunks")
    def handler(ctx):
        for chunk in range(5):
            processed.append(chunk)
            if chunk == 1:
                queue.request_cancel(ctx.db, ctx.job.id)
            ctx.progress((chunk + 1) * 20, f"chunk {chunk + 1}")
        return {"chunks": 5}

    job = _enqueue(qdb, type="test.chunks").job
    claimed = queue.claim(qdb, W)
    assert execute_job(qdb, claimed, W) == "cancelled"
    assert processed == [0, 1]
    qdb.refresh(job)
    assert job.status == "cancelled" and job.finished_at is not None


@requires_db
def test_per_lane_concurrency(qdb, monkeypatch):
    monkeypatch.setattr(settings, "jobs_max_concurrent_dukascopy", 1)
    monkeypatch.setattr(settings, "jobs_max_concurrent_binance", 2)
    d1, d2 = _enqueue(qdb, "dukascopy").job, _enqueue(qdb, "dukascopy").job
    b = [_enqueue(qdb, "binance").job for _ in range(3)]
    first = queue.claim(qdb, W, lanes=("dukascopy",))
    assert first.id == d1.id
    assert queue.claim(qdb, W, lanes=("dukascopy",)) is None
    claimed = [queue.claim(qdb, W, lanes=("binance",)) for _ in range(3)]
    assert [c.id if c else None for c in claimed] == [b[0].id, b[1].id, None]
    queue.complete(qdb, first)
    assert queue.claim(qdb, W, lanes=("dukascopy",)).id == d2.id
    assert queue.running_counts(qdb) == {"dukascopy": 1, "binance": 2}


@requires_db
def test_execute_job_outcomes(qdb):
    @queue.register_handler("test.provider_error")
    def provider_error(ctx):
        raise ProviderError("region_blocked", "451 everywhere", retryable=False)

    @queue.register_handler("test.crash")
    def crash(ctx):
        raise RuntimeError("bug")

    @queue.register_handler("test.ok")
    def ok(ctx):
        return {"rows": 3}

    for job_type, status in [("test.provider_error", "failed"), ("test.crash", "queued"), ("test.ok", "succeeded"), ("test.missing", "failed")]:
        _enqueue(qdb, type=job_type)
        assert execute_job(qdb, queue.claim(qdb, W), W) == status, job_type
    assert qdb.query(Job).filter_by(type="test.ok").one().result == {"rows": 3}


@requires_db
def test_heartbeat_upsert(qdb):
    write_heartbeat(qdb, "a", {"running": 0})
    write_heartbeat(qdb, "b", {"running": 2})
    row = qdb.get(WorkerHeartbeat, "market_worker")
    qdb.refresh(row)
    assert row.instance == "b" and row.info == {"running": 2}


# --- singleton worker ---------------------------------------------------------------------------

@requires_db
def test_second_worker_is_denied_the_advisory_lock():
    key = 740_000 + random.randint(100, 999)
    first, second = AdvisoryLock(key, ENGINE), AdvisoryLock(key, ENGINE)
    try:
        assert first.try_acquire() and first.alive()
        assert not second.try_acquire()
        first.release()
        assert second.try_acquire()
    finally:
        first.release()
        second.release()


class _DeniedLock:
    key = 1
    held = False

    def try_acquire(self):
        return False

    def alive(self):
        return False

    def release(self):
        pass


def test_worker_without_lock_idles():
    worker = MarketWorker(session_factory=lambda: pytest.fail("must not touch the queue"), lock=_DeniedLock(), poll_seconds=0.01)
    timer = threading.Timer(0.2, worker.stop_event.set)
    timer.start()
    worker.run_forever()
    timer.join()


# --- limiter ------------------------------------------------------------------------------------

def test_token_bucket_paces_requests():
    clock = {"t": 0.0}
    waits: list[float] = []

    def sleep(seconds):
        waits.append(seconds)
        clock["t"] += seconds

    bucket = TokenBucket(2.0, capacity=2, clock=lambda: clock["t"], sleep=sleep)
    for _ in range(6):
        bucket.acquire()
    assert waits == pytest.approx([0.5, 0.5, 0.5, 0.5])
    assert not bucket.try_acquire()
    clock["t"] += 0.5
    assert bucket.try_acquire()


# --- errors, entitlements, admin ----------------------------------------------------------------

def _app(user_role: str = "trader") -> TestClient:
    from types import SimpleNamespace

    from app.main import backtest_error_handler

    app = FastAPI()
    app.add_exception_handler(BacktestError, backtest_error_handler)
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(role=user_role)

    @app.get("/preparing")
    def preparing():
        raise BacktestError("data_preparing", "Fetching market data.", job_id="j-1", retry_after_s=2)

    @app.get("/limit")
    def limit():
        raise BacktestError("limit_exceeded", "Too many bars.", details={"max_bars": 5000})

    @app.get("/admin")
    def admin(user=Depends(require_admin)):
        return {"ok": True}

    @app.get("/replay")
    def replay(user=Depends(require_feature("backtesting.replay"))):
        return {"ok": True}

    return TestClient(app)


def test_error_handler_shape():
    client = _app()
    response = client.get("/preparing")
    assert response.status_code == 202
    assert response.json() == {"code": "data_preparing", "message": "Fetching market data.", "job_id": "j-1"}
    assert response.headers["retry-after"] == "2"
    response = client.get("/limit")
    assert response.status_code == 422
    assert response.json() == {"code": "limit_exceeded", "message": "Too many bars.", "details": {"max_bars": 5000}}
    with pytest.raises(ValueError):
        BacktestError("made_up", "x")


def test_require_admin_and_feature_check():
    assert _app("trader").get("/admin").status_code == 403
    assert _app("admin").get("/admin").status_code == 200
    assert _app().get("/replay").json() == {"ok": True}
    with pytest.raises(ValueError):
        check_feature(object(), "backtesting.unknown")
    with pytest.raises(ValueError):
        require_feature("nope")


@requires_db
def test_make_admin_is_idempotent_and_revocable(db, monkeypatch, capsys):  # noqa: F811
    user = make_user(db)
    _, changed = set_admin(db, user.email.upper())
    assert changed and user.role == "admin"
    assert set_admin(db, user.email)[1] is False
    with pytest.raises(LookupError):
        set_admin(db, "nobody@nowhere.test")

    @contextmanager
    def session():
        yield db

    import app.core.db as core_db
    from app.cli.marketdata import main

    monkeypatch.setattr(core_db, "SessionLocal", session)
    assert main(["make-admin", user.email, "--revoke"]) == 0
    assert user.role == "trader"
    assert "role=trader" in capsys.readouterr().out
    assert main(["make-admin", "missing@nowhere.test"]) == 1
