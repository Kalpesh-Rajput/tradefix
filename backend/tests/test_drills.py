"""Fixture-provider drills: top-up gaps, provider failures, a killed worker, and the candle cache."""

from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta, timezone

import numpy as np
import pytest

from app.models.job import Job
from app.services.jobs import queue
from app.services.marketdata.cache import CacheKey, CandleCache
from app.services.marketdata.candles import MINUTE_MS, Candles
from app.services.marketdata.coverage import record_fetch, reset_coverage
from app.services.marketdata.operations import top_up
from app.services.marketdata.providers.base import Chunk, ProviderError
from app.services.marketdata.registry import get_instrument, mirror_to_db
from app.services.marketdata.store import LocalParquetStore
from app.services.marketdata.topup import cross_check, enqueue_crosscheck, enqueue_topup
from tests.bt_support import db, requires_db  # noqa: F401

pytestmark = requires_db

DAY = 86_400_000
T0 = int(datetime(2026, 2, 3, tzinfo=timezone.utc).timestamp() * 1000)


def _minutes(start: int, end: int) -> Candles:
    ts = np.arange(start, end, MINUTE_MS, dtype=np.int64)
    price = np.full(ts.size, 100.0)
    return Candles.from_columns({"ts": ts, "open": price, "high": price, "low": price, "close": price, "volume": np.ones(ts.size)})


class FakeProvider:
    def __init__(self, error: ProviderError | None = None):
        self.error = error
        self.calls: list[tuple[int, int]] = []

    def iter_chunks(self, spec, start, end):
        self.calls.append((start, end))
        if self.error is not None:
            raise self.error
        yield Chunk(start, end, _minutes(start, end), "fake")


@pytest.fixture()
def stored(db, tmp_path):  # noqa: F811
    mirror_to_db(db)
    reset_coverage(db, "BTCUSDT")
    spec = get_instrument("BTCUSDT")
    store = LocalParquetStore(tmp_path)
    record_fetch(db, store, spec, T0, T0 + 60 * MINUTE_MS, _minutes(T0, T0 + 60 * MINUTE_MS))
    return db, store, spec


def test_topup_fills_a_skipped_night_once(stored):
    db, store, spec = stored
    provider = FakeProvider()
    now = T0 + 2 * DAY + 3_600_000
    first = top_up(db, store=store, provider_factory=lambda _source: provider, now_ms=now, specs=[spec])
    assert first[0]["status"] == "updated" and provider.calls
    rows = store.count(spec.source, spec.symbol, T0, T0 + 3 * DAY)
    second = top_up(db, store=store, provider_factory=lambda _source: provider, now_ms=now, specs=[spec])
    assert second[0]["status"] == "up_to_date"
    assert store.count(spec.source, spec.symbol, T0, T0 + 3 * DAY) == rows
    assert len(provider.calls) == 1


@pytest.mark.parametrize("code,message", [("rate_limited", "429"), ("banned", "418"), ("region_blocked", "451"), ("tool_failed", "dukascopy tool failed")])
def test_provider_failure_does_not_extend_coverage(stored, code, message):
    db, store, spec = stored
    provider = FakeProvider(ProviderError(code, message, retryable=code == "rate_limited"))
    summary = top_up(db, store=store, provider_factory=lambda _source: provider, now_ms=T0 + DAY + 1, specs=[spec])
    assert summary[0]["status"] == "failed"
    assert store.count(spec.source, spec.symbol, T0 + 60 * MINUTE_MS, T0 + DAY) == 0


def test_disk_full_leaves_the_previous_rows(stored, monkeypatch):
    db, store, spec = stored
    before = store.count(spec.source, spec.symbol, T0, T0 + DAY)

    def broken(*_args, **_kwargs):
        raise OSError("disk full")

    monkeypatch.setattr(store, "write", broken)
    provider = FakeProvider()
    with pytest.raises(OSError, match="disk full"):
        top_up(db, store=store, provider_factory=lambda _source: provider, now_ms=T0 + DAY, specs=[spec])
    assert store.count(spec.source, spec.symbol, T0, T0 + DAY) == before


def test_expired_worker_lock_requeues_ingest_and_backtest(db):  # noqa: F811
    past = datetime.now(timezone.utc) - timedelta(minutes=5)
    jobs = []
    for job_type in ("candles.ingest", "backtest.run"):
        job = Job(type=job_type, lane="backtest" if job_type.startswith("backtest") else "binance", status="running", payload={}, attempts=1, max_attempts=3, locked_by="dead", locked_until=past)
        db.add(job)
        jobs.append(job)
    db.commit()
    assert queue.recover_expired(db) >= 2
    for job in jobs:
        db.refresh(job)
        assert job.status == "queued"


def test_scheduled_jobs_share_a_day_key_and_log(db, caplog):  # noqa: F811
    with caplog.at_level(logging.INFO, logger="tradefix.marketdata"):
        first = enqueue_topup(db, day="2026-10-15")
        second = enqueue_topup(db, day="2026-10-15")
        cross = enqueue_crosscheck(db, day="2026-10-15")
    assert first.created is True
    assert second.created is False and second.job.id == first.job.id
    assert cross.created is True and cross.job.dedup_key == "crosscheck:2026-10-15"
    assert any(getattr(record, "dedup_key", None) == "topup:2026-10-15" for record in caplog.records)


def test_cross_check_flags_only_large_differences():
    spec = get_instrument("BTCUSDT")
    assert cross_check(None, reference=lambda _spec: (100.0, 100.0), specs=[spec])[0]["status"] == "ok"
    assert cross_check(None, reference=lambda _spec: (100.0, 110.0), specs=[spec])[0]["status"] == "diff"


def test_cached_read_is_faster_than_the_first_load():
    cache = CandleCache(max_entries=4)
    key = CacheKey("binance", "BTCUSDT", "1m", 0, 60_000)
    started = time.perf_counter()
    time.sleep(0.03)
    cache.put(key, Candles.empty())
    cold = time.perf_counter() - started
    started = time.perf_counter()
    assert cache.get(key) is not None
    warm = time.perf_counter() - started
    assert cache.hits == 1 and warm < cold
