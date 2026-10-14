"""Parquet candle store: atomic replace, retries, locking, DuckDB per query (backtesting 1D, D-020)."""

from __future__ import annotations

import os
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pyarrow.parquet as pq
import pytest

from app.services.marketdata import store as store_mod
from app.services.marketdata.candles import MINUTE_MS, Candles
from app.services.marketdata.store import LocalParquetStore, _FileLock, atomic_replace, months_between

T0 = int(datetime(2026, 3, 31, 23, 50, tzinfo=timezone.utc).timestamp() * 1000)


def _batch(start: int, n: int, close: float = 100.0) -> Candles:
    ts = start + np.arange(n) * MINUTE_MS
    return Candles.from_columns({"ts": ts, "open": [100.0] * n, "high": [101.0] * n, "low": [99.0] * n, "close": [close] * n, "volume": [1.0] * n})


@pytest.fixture()
def store(tmp_path: Path) -> LocalParquetStore:
    return LocalParquetStore(tmp_path)


def test_write_splits_months_and_reads_back(store):
    writes = store.write("binance", "BTCUSDT", _batch(T0, 20))
    assert [(w.year, w.month, w.rows_written) for w in writes] == [(2026, 3, 10), (2026, 4, 10)]
    path = store.month_path("binance", "BTCUSDT", 2026, 4)
    assert path.exists()
    assert pq.ParquetFile(path).metadata.row_group(0).column(0).compression == "ZSTD"
    back = store.read("binance", "BTCUSDT", T0, T0 + 20 * MINUTE_MS)
    assert back.ts.tolist() == (T0 + np.arange(20) * MINUTE_MS).tolist()
    assert store.count("binance", "BTCUSDT", T0 + 5 * MINUTE_MS, T0 + 15 * MINUTE_MS) == 10
    assert months_between(T0, T0 + 20 * MINUTE_MS) == [(2026, 3), (2026, 4)]


def test_dedup_merge_new_rows_win(store):
    store.write("binance", "BTCUSDT", _batch(T0, 5, close=100.0))
    store.write("binance", "BTCUSDT", _batch(T0 + 3 * MINUTE_MS, 4, close=100.5))
    back = store.read("binance", "BTCUSDT", T0, T0 + 10 * MINUTE_MS)
    assert back.ts.tolist() == (T0 + np.arange(7) * MINUTE_MS).tolist()
    assert back.close.tolist() == [100.0] * 3 + [100.5] * 4


def test_crash_between_temp_write_and_replace_keeps_old_file(store, monkeypatch):
    store.write("binance", "BTCUSDT", _batch(T0, 5))
    path = store.month_path("binance", "BTCUSDT", 2026, 3)
    before = path.read_bytes()

    def crash(tmp, dest, **_):
        assert Path(tmp).exists()
        raise RuntimeError("power loss")

    monkeypatch.setattr(store_mod, "atomic_replace", crash)
    with pytest.raises(RuntimeError):
        store.write("binance", "BTCUSDT", _batch(T0, 5, close=105.0))
    assert path.read_bytes() == before
    assert list(store.tmp_dir.iterdir()) == []


def test_permission_error_is_retried_then_succeeds(tmp_path):
    tmp, dest = tmp_path / "a.tmp", tmp_path / "a.parquet"
    tmp.write_text("new")
    dest.write_text("old")
    calls, waits = [], []

    def flaky(src, dst):
        calls.append(1)
        if len(calls) < 3:
            raise PermissionError("in use")
        os.replace(src, dst)

    atomic_replace(tmp, dest, replace=flaky, sleep=waits.append)
    assert dest.read_text() == "new"
    assert waits == [0.05, 0.1]
    assert not tmp.exists()


def test_permission_error_exhausted_cleans_temp(tmp_path):
    tmp, dest = tmp_path / "a.tmp", tmp_path / "a.parquet"
    tmp.write_text("new")
    dest.write_text("old")
    waits = []

    def blocked(src, dst):
        raise PermissionError("in use")

    with pytest.raises(PermissionError):
        atomic_replace(tmp, dest, replace=blocked, sleep=waits.append)
    assert waits == [0.05, 0.1, 0.2, 0.4, 0.8]
    assert dest.read_text() == "old" and not tmp.exists()


def test_replace_succeeds_once_a_reader_releases_the_file(tmp_path):
    tmp, dest = tmp_path / "a.tmp", tmp_path / "a.parquet"
    tmp.write_text("new")
    dest.write_text("old")
    handle = open(dest, "rb")
    releaser = threading.Timer(0.12, handle.close)
    releaser.start()
    try:
        atomic_replace(tmp, dest)
    finally:
        releaser.join()
        handle.close()
    assert dest.read_text() == "new"


def test_replace_right_after_duckdb_read(store):
    store.write("binance", "BTCUSDT", _batch(T0, 5))
    for i in range(15):
        assert len(store.read("binance", "BTCUSDT", T0, T0 + 10 * MINUTE_MS)) == 5 + min(i, 5)
        store.write("binance", "BTCUSDT", _batch(T0 + (5 + i) * MINUTE_MS, 1))


def test_concurrent_writers_are_serialized(store):
    start = int(datetime(2026, 3, 1, tzinfo=timezone.utc).timestamp() * 1000)
    errors: list[BaseException] = []

    def writer(k: int):
        try:
            for j in range(5):
                store.write("binance", "BTCUSDT", _batch(start + (k * 5 + j) * MINUTE_MS, 1))
        except BaseException as exc:  # pragma: no cover - surfaced below
            errors.append(exc)

    threads = [threading.Thread(target=writer, args=(k,)) for k in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert errors == []
    assert store.count("binance", "BTCUSDT", start, start + 40 * MINUTE_MS) == 40


def test_file_lock_excludes_a_second_holder(tmp_path):
    path = tmp_path / "x.lock"
    with _FileLock(path):
        started = time.monotonic()
        with pytest.raises(TimeoutError):
            with _FileLock(path, timeout=0.15):
                pass
        assert time.monotonic() - started >= 0.15
    with _FileLock(path, timeout=0.15):
        pass
