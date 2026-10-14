"""Candle storage (backtesting/02 section 4, D-020).

Layout: <root>/candles/<source>/<SYMBOL>/<YYYY>/<MM>/candles.parquet, one sorted zstd file per
instrument-month, rewritten whole on every write via a temp file in <root>/tmp and an atomic replace.
Reads open a fresh in-memory DuckDB connection per query with an explicit file list.

An S3-compatible store implements the same `CandleStore` methods: write the merged month to a temp
object, then copy/commit it over the final key, and read with DuckDB httpfs `read_parquet('s3://...')`.
"""

from __future__ import annotations

import logging
import os
import threading
import time
import uuid
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterator, Protocol

import duckdb
import numpy as np
import pyarrow.parquet as pq

from app.core.config import settings
from app.services.marketdata.candles import COLUMNS, Candles
from app.services.marketdata.validation import validate_batch

logger = logging.getLogger(__name__)

REPLACE_RETRY_DELAYS = (0.05, 0.1, 0.2, 0.4, 0.8)
LOCK_TIMEOUT_S = 60.0
FILE_NAME = "candles.parquet"


@dataclass(frozen=True)
class MonthWrite:
    year: int
    month: int
    rows_written: int
    rows_in_file: int


class CandleStore(Protocol):
    def write(self, source: str, symbol: str, batch: Candles) -> list[MonthWrite]: ...

    def read(self, source: str, symbol: str, start_ms: int, end_ms: int) -> Candles: ...

    def files_for(self, source: str, symbol: str, start_ms: int, end_ms: int) -> list[str]: ...

    def count(self, source: str, symbol: str, start_ms: int, end_ms: int) -> int: ...


def month_key(ts_ms: int) -> tuple[int, int]:
    moment = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc)
    return moment.year, moment.month


def month_bounds(year: int, month: int) -> tuple[int, int]:
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    end = datetime(year + (month == 12), month % 12 + 1, 1, tzinfo=timezone.utc)
    return int(start.timestamp() * 1000), int(end.timestamp() * 1000)


def months_between(start_ms: int, end_ms: int) -> list[tuple[int, int]]:
    if end_ms <= start_ms:
        return []
    year, month = month_key(start_ms)
    last = month_key(end_ms - 1)
    out = []
    while (year, month) <= last:
        out.append((year, month))
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    return out


def atomic_replace(
    tmp: Path,
    dest: Path,
    *,
    delays: tuple[float, ...] = REPLACE_RETRY_DELAYS,
    sleep: Callable[[float], None] = time.sleep,
    replace: Callable[[Path, Path], None] = os.replace,
) -> None:
    """os.replace with PermissionError retries (Windows blocks renaming over a file another handle has open)."""
    try:
        for delay in (*delays, None):
            try:
                replace(tmp, dest)
                return
            except PermissionError:
                if delay is None:
                    raise
                logger.warning("candle file replace blocked, retrying", extra={"dest": str(dest), "delay_s": delay})
                sleep(delay)
    finally:
        tmp.unlink(missing_ok=True)


class _FileLock:
    """Exclusive OS lock on a sidecar file, so writers in different processes (API inline fill and the
    market worker) serialize on the same instrument-month."""

    def __init__(self, path: Path, timeout: float = LOCK_TIMEOUT_S) -> None:
        self.path = path
        self.timeout = timeout
        self._fh: Any = None

    def __enter__(self) -> "_FileLock":
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._fh = open(self.path, "a+b")
        deadline = time.monotonic() + self.timeout
        while True:
            try:
                _lock_fd(self._fh.fileno())
                return self
            except OSError:
                if time.monotonic() > deadline:
                    self._fh.close()
                    raise TimeoutError(f"timed out waiting for {self.path.name}")
                time.sleep(0.02)

    def __exit__(self, *exc) -> None:
        try:
            _unlock_fd(self._fh.fileno())
        finally:
            self._fh.close()


if os.name == "nt":
    import msvcrt

    def _lock_fd(fd: int) -> None:
        os.lseek(fd, 0, os.SEEK_SET)
        msvcrt.locking(fd, msvcrt.LK_NBLCK, 1)

    def _unlock_fd(fd: int) -> None:
        os.lseek(fd, 0, os.SEEK_SET)
        msvcrt.locking(fd, msvcrt.LK_UNLCK, 1)

else:
    import fcntl

    def _lock_fd(fd: int) -> None:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)

    def _unlock_fd(fd: int) -> None:
        fcntl.flock(fd, fcntl.LOCK_UN)


def duckdb_query(sql: str, params: dict[str, Any]) -> dict[str, np.ndarray]:
    """Run one query on a fresh in-memory DuckDB connection and close it before returning (D-020)."""
    con = duckdb.connect(":memory:")
    try:
        return con.execute(sql, params).fetchnumpy()
    finally:
        con.close()


class LocalParquetStore:
    def __init__(self, root: Path | str | None = None) -> None:
        self.root = Path(root or settings.market_data_dir).resolve()
        self.candles_dir = self.root / "candles"
        self.tmp_dir = self.root / "tmp"
        self.locks_dir = self.root / "locks"
        self._guard = threading.Lock()
        self._thread_locks: dict[str, threading.Lock] = {}

    def month_path(self, source: str, symbol: str, year: int, month: int) -> Path:
        return self.candles_dir / source / symbol / f"{year:04d}" / f"{month:02d}" / FILE_NAME

    @contextmanager
    def month_lock(self, source: str, symbol: str, year: int, month: int) -> Iterator[None]:
        key = f"{source}_{symbol}_{year:04d}_{month:02d}"
        with self._guard:
            lock = self._thread_locks.setdefault(key, threading.Lock())
        with lock, _FileLock(self.locks_dir / f"{key}.lock"):
            yield

    def read_month(self, source: str, symbol: str, year: int, month: int) -> Candles:
        path = self.month_path(source, symbol, year, month)
        if not path.exists():
            return Candles.empty()
        return Candles.from_arrow(pq.read_table(path, columns=list(COLUMNS)))

    def _write_month(self, source: str, symbol: str, year: int, month: int, batch: Candles) -> MonthWrite:
        with self.month_lock(source, symbol, year, month):
            dest = self.month_path(source, symbol, year, month)
            merged, _ = validate_batch(Candles.concat(self.read_month(source, symbol, year, month), batch), symbol=symbol)
            dest.parent.mkdir(parents=True, exist_ok=True)
            self.tmp_dir.mkdir(parents=True, exist_ok=True)
            tmp = self.tmp_dir / f"{symbol}-{year:04d}{month:02d}-{uuid.uuid4().hex}.parquet"
            try:
                pq.write_table(merged.to_arrow(), tmp, compression="zstd")
                atomic_replace(tmp, dest)
            finally:
                tmp.unlink(missing_ok=True)
            return MonthWrite(year, month, len(batch), len(merged))

    def write(self, source: str, symbol: str, batch: Candles) -> list[MonthWrite]:
        """Merge a validated batch into its month files; rows in `batch` win over stored duplicates."""
        if not len(batch):
            return []
        writes = []
        for year, month in months_between(int(batch.ts.min()), int(batch.ts.max()) + 1):
            start, end = month_bounds(year, month)
            part = batch.between(start, end)
            if len(part):
                writes.append(self._write_month(source, symbol, year, month, part))
        return writes

    def files_for(self, source: str, symbol: str, start_ms: int, end_ms: int) -> list[str]:
        paths = (self.month_path(source, symbol, y, m) for y, m in months_between(start_ms, end_ms))
        return [str(p) for p in paths if p.exists()]

    def read(self, source: str, symbol: str, start_ms: int, end_ms: int) -> Candles:
        files = self.files_for(source, symbol, start_ms, end_ms)
        if not files:
            return Candles.empty()
        result = duckdb_query(
            "SELECT ts, open, high, low, close, volume FROM read_parquet($files) "
            "WHERE ts >= $start AND ts < $end ORDER BY ts",
            {"files": files, "start": start_ms, "end": end_ms},
        )
        return Candles.from_columns(result)

    def count(self, source: str, symbol: str, start_ms: int, end_ms: int) -> int:
        files = self.files_for(source, symbol, start_ms, end_ms)
        if not files:
            return 0
        result = duckdb_query(
            "SELECT count(*) AS n FROM read_parquet($files) WHERE ts >= $start AND ts < $end",
            {"files": files, "start": start_ms, "end": end_ms},
        )
        return int(result["n"][0])


_default: LocalParquetStore | None = None


def get_store() -> LocalParquetStore:
    global _default
    if _default is None:
        _default = LocalParquetStore()
    return _default
