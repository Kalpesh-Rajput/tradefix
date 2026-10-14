"""ensure_candles / get_candles / cache / ingest handler with mocked providers (backtesting 1G)."""

from __future__ import annotations

import threading
import time
from datetime import datetime, timezone

import numpy as np
import pytest
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.job import Job
from app.services.backtest.errors import BacktestError
from app.services.jobs import queue
from app.services.marketdata import candle_service
from app.services.marketdata.cache import CacheKey, CandleCache, candle_cache
from app.services.marketdata.candle_service import ensure_candles, get_candles
from app.services.marketdata.candles import MINUTE_MS, Candles
from app.services.marketdata.coverage import covered_ranges, record_fetch, reset_coverage
from app.services.marketdata.ingest_jobs import dedup_key, fill_gaps, handle_ingest
from app.services.marketdata.providers.base import Chunk, ProviderError
from app.services.marketdata.registry import get_instrument, mirror_to_db
from app.services.marketdata.store import LocalParquetStore
from tests.bt_support import ENGINE, db, requires_db  # noqa: F401

pytestmark = requires_db

H = 3_600_000
T0 = int(datetime(2026, 2, 3, tzinfo=timezone.utc).timestamp() * 1000)
BTC = get_instrument("BTCUSDT")
EURUSD = get_instrument("EURUSD")


def _minutes(start: int, end: int) -> Candles:
    ts = np.arange(start, end, MINUTE_MS, dtype=np.int64)
    price = 100 + (ts - T0) / MINUTE_MS * 0.01
    return Candles.from_columns({"ts": ts, "open": price, "high": price + 0.5, "low": price - 0.5, "close": price + 0.1, "volume": np.ones(ts.size)})


class FakeProvider:
    name = "fake"

    def __init__(self, *, error: ProviderError | None = None, gate: threading.Event | None = None):
        self.calls: list[tuple[int, int]] = []
        self.error = error
        self.gate = gate

    def iter_chunks(self, spec, start, end):
        self.calls.append((start, end))
        if self.gate is not None:
            self.gate.wait(10)
        if self.error is not None:
            raise self.error
        yield Chunk(start, end, _minutes(start, end), "fake")


class Borrowed:
    """Lets the inline pool use the test session; close() is a no-op so the fixture keeps it."""

    def __init__(self, session):
        self._session = session

    def __getattr__(self, name):
        return getattr(self._session, name)

    def close(self):
        pass


@pytest.fixture()
def env(db, tmp_path):  # noqa: F811
    mirror_to_db(db)
    for symbol in ("BTCUSDT", "EURUSD"):
        reset_coverage(db, symbol)
    db.execute(delete(Job))
    db.flush()
    candle_cache.clear()
    store = LocalParquetStore(tmp_path)
    return db, store


def _ensure(db, store, spec, start, end, provider):
    return ensure_candles(db, spec, start, end, store=store, provider_factory=lambda _s: provider, session_factory=lambda: Borrowed(db))


def test_no_gap_returns_instantly(env):
    db, store = env
    record_fetch(db, store, BTC, T0, T0 + H, _minutes(T0, T0 + H))
    provider = FakeProvider()
    started = time.monotonic()
    result = _ensure(db, store, BTC, T0 + 5 * MINUTE_MS, T0 + 30 * MINUTE_MS, provider)
    assert result.ready and result.via == "stored" and provider.calls == []
    assert time.monotonic() - started < 0.5


def test_small_binance_gap_is_filled_inline(env):
    db, store = env
    provider = FakeProvider()
    result = _ensure(db, store, BTC, T0, T0 + 2 * H, provider)
    assert result.ready and result.via == "inline"
    assert provider.calls == [(T0, T0 + 2 * H)]
    assert covered_ranges(db, "BTCUSDT", "binance") == [(T0, T0 + 2 * H)]
    assert db.scalar(select(func.count()).select_from(Job)) == 0


def test_dukascopy_gap_always_becomes_a_job(env):
    db, store = env
    provider = FakeProvider()
    result = _ensure(db, store, EURUSD, T0, T0 + 10 * MINUTE_MS, provider)
    assert result.status == "preparing" and result.via == "job_only_source" and provider.calls == []
    job = db.get(Job, __import__("uuid").UUID(result.job_id))
    assert job.lane == "dukascopy" and job.type == "candles.ingest"
    assert job.dedup_key == dedup_key("EURUSD", T0, T0 + 10 * MINUTE_MS)


def test_large_binance_gap_becomes_a_job(env, monkeypatch):
    db, store = env
    monkeypatch.setattr(settings, "inline_fetch_max_gap_minutes", 60)
    result = _ensure(db, store, BTC, T0, T0 + 2 * H, FakeProvider())
    assert result.status == "preparing" and result.via == "gap_too_large"


def test_over_inline_cap_becomes_a_job(env, monkeypatch):
    db, store = env
    slots = threading.BoundedSemaphore(1)
    slots.acquire()
    monkeypatch.setattr(candle_service, "_inline_slots", slots)
    provider = FakeProvider()
    result = _ensure(db, store, BTC, T0, T0 + H, provider)
    assert result.status == "preparing" and result.via == "inline_cap" and provider.calls == []


def test_inline_timeout_becomes_a_job(env, monkeypatch):
    db, store = env
    monkeypatch.setattr(settings, "inline_fetch_timeout_s", 0.2)
    slots = threading.BoundedSemaphore(1)
    monkeypatch.setattr(candle_service, "_inline_slots", slots)
    gate = threading.Event()
    provider = FakeProvider(gate=gate)
    started = time.monotonic()
    result = _ensure(db, store, BTC, T0, T0 + H, provider)
    assert result.status == "preparing" and result.via == "inline_timeout"
    assert time.monotonic() - started < 2
    assert db.scalar(select(func.count()).select_from(Job).where(Job.dedup_key == dedup_key("BTCUSDT", T0, T0 + H))) == 1
    gate.set()
    assert slots.acquire(timeout=10)
    slots.release()


def test_provider_failure_leaves_coverage_unchanged(env):
    db, store = env
    retryable = FakeProvider(error=ProviderError("provider_unavailable", "down"))
    result = _ensure(db, store, BTC, T0, T0 + H, retryable)
    assert result.status == "preparing" and result.via == "inline_failed:provider_unavailable"
    assert covered_ranges(db, "BTCUSDT", "binance") == []
    blocked = FakeProvider(error=ProviderError("region_blocked", "451", retryable=False))
    with pytest.raises(BacktestError) as exc:
        _ensure(db, store, BTC, T0, T0 + H, blocked)
    assert exc.value.code == "data_unavailable"
    assert covered_ranges(db, "BTCUSDT", "binance") == []


def test_many_concurrent_callers_create_one_job(tmp_path):
    store = LocalParquetStore(tmp_path)
    start = int(datetime(2003, 6, 2, 8, tzinfo=timezone.utc).timestamp() * 1000)
    key = dedup_key("EURUSD", start, start + 6 * H)
    results: list[str] = []
    errors: list[BaseException] = []
    barrier = threading.Barrier(8)

    def caller(offset: int):
        with Session(ENGINE) as session:
            try:
                barrier.wait()
                result = ensure_candles(session, EURUSD, start + offset * MINUTE_MS, start + 6 * H - offset * MINUTE_MS, store=store)
                results.append(result.job_id)
            except BaseException as exc:  # pragma: no cover - surfaced below
                errors.append(exc)

    threads = [threading.Thread(target=caller, args=(i,)) for i in range(8)]
    try:
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        assert errors == []
        assert len(set(results)) == 1
        with Session(ENGINE) as session:
            assert session.scalar(select(func.count()).select_from(Job).where(Job.dedup_key == key)) == 1
    finally:
        with Session(ENGINE) as session:
            session.execute(delete(Job).where(Job.dedup_key == key))
            session.commit()


def test_get_candles_completeness_cap_and_flags(env):
    db, store = env
    record_fetch(db, store, BTC, T0, T0 + 3 * H, _minutes(T0, T0 + 3 * H))
    hourly = get_candles(db, BTC, "1h", T0, T0 + 3 * H, until_ms=T0 + 2 * H + 30 * MINUTE_MS, store=store, now_ms=T0 + 10 * H)
    assert hourly.candles.ts.tolist() == [T0, T0 + H]
    assert hourly.candles.open[0] == pytest.approx(100.0) and hourly.candles.volume[0] == 60
    assert get_candles(db, BTC, "4h", T0, T0 + 4 * H, store=store, now_ms=T0 + 10 * H).candles.ts.tolist() == []
    forming = get_candles(db, BTC, "1m", T0, T0 + 3 * H, store=store, now_ms=T0 + 10 * MINUTE_MS + 30_000)
    assert len(forming.candles) == 10
    capped = get_candles(db, BTC, "1m", T0, T0 + 3 * H, max_bars=30, store=store, now_ms=T0 + 10 * H)
    assert len(capped.candles) == 30 and capped.has_more_after
    later = get_candles(db, BTC, "5m", T0 + H, T0 + 2 * H, store=store, now_ms=T0 + 10 * H)
    assert later.has_more_before and later.earliest_ms == T0 and len(later.candles) == 12
    with pytest.raises(BacktestError):
        get_candles(db, BTC, "1h", T0, T0, store=store)


def test_buckets_outside_coverage_are_not_returned(env):
    db, store = env
    store.write("binance", "BTCUSDT", _minutes(T0, T0 + 2 * H))
    record_fetch(db, store, BTC, T0, T0 + H + 30 * MINUTE_MS, _minutes(T0, T0 + H + 30 * MINUTE_MS))
    hourly = get_candles(db, BTC, "1h", T0, T0 + 2 * H, store=store, now_ms=T0 + 10 * H)
    assert hourly.candles.ts.tolist() == [T0]


def test_cache_only_holds_covered_windows_and_invalidates_on_write(env):
    db, store = env
    cache = CandleCache(max_entries=8)
    record_fetch(db, store, BTC, T0, T0 + H, _minutes(T0, T0 + H))
    get_candles(db, BTC, "5m", T0, T0 + 2 * H, store=store, cache=cache, now_ms=T0 + 10 * H)
    assert len(cache) == 0
    get_candles(db, BTC, "5m", T0, T0 + H, store=store, cache=cache, now_ms=T0 + 10 * H)
    get_candles(db, BTC, "5m", T0, T0 + H, store=store, cache=cache, now_ms=T0 + 10 * H)
    assert len(cache) == 1 and cache.hits == 1
    assert cache.invalidate("binance", "BTCUSDT", T0 + 30 * MINUTE_MS, T0 + 31 * MINUTE_MS) == 1
    assert len(cache) == 0
    candle_cache.put(CacheKey("binance", "BTCUSDT", "5m", T0, T0 + H), Candles.empty())
    fill_gaps(db, BTC, [(T0 + H, T0 + 2 * H)], store=store, provider=FakeProvider())
    assert candle_cache.get(CacheKey("binance", "BTCUSDT", "5m", T0, T0 + H)) is not None
    fill_gaps(db, BTC, [(T0 + 50 * MINUTE_MS, T0 + H)], store=store, provider=FakeProvider())
    assert candle_cache.get(CacheKey("binance", "BTCUSDT", "5m", T0, T0 + H)) is None


def test_cache_is_bounded_lru():
    cache = CandleCache(max_entries=2)
    keys = [CacheKey("binance", "BTCUSDT", "1m", i, i + 1) for i in range(3)]
    cache.put(keys[0], Candles.empty())
    cache.put(keys[1], Candles.empty())
    cache.get(keys[0])
    cache.put(keys[2], Candles.empty())
    assert cache.get(keys[1]) is None and cache.get(keys[0]) is not None


def test_ingest_job_handler_fills_and_reports_progress(env):
    db, store = env
    enqueued = queue.enqueue(db, type="candles.ingest", lane="binance", payload={"symbol": "BTCUSDT", "start_ms": T0, "end_ms": T0 + H})
    job = queue.claim(db, "w")
    assert job.id == enqueued.job.id
    ctx = queue.JobContext(db=db, job=job, worker_id="w")
    result = handle_ingest(ctx, store=store, provider_factory=lambda _s: FakeProvider())
    assert result == {"rows": 60, "chunks": 1}
    db.refresh(job)
    assert job.progress == 99 and "1 chunk" in job.progress_message
    again = handle_ingest(ctx, store=store, provider_factory=lambda _s: FakeProvider())
    assert again["already_covered"] is True
