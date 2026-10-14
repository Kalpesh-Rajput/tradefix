"""Canonical 1-minute candle batch (backtesting/02 section 1): columnar numpy arrays, epoch-ms UTC bar starts."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Mapping

import numpy as np
import pyarrow as pa

MINUTE_MS = 60_000
COLUMNS = ("ts", "open", "high", "low", "close", "volume")
ARROW_SCHEMA = pa.schema(
    [("ts", pa.int64())] + [(name, pa.float64()) for name in COLUMNS[1:]]
)


@dataclass(frozen=True)
class Candles:
    ts: np.ndarray
    open: np.ndarray
    high: np.ndarray
    low: np.ndarray
    close: np.ndarray
    volume: np.ndarray

    def __post_init__(self) -> None:
        sizes = {len(getattr(self, name)) for name in COLUMNS}
        if len(sizes) > 1:
            raise ValueError("candle columns must have equal length")

    def __len__(self) -> int:
        return int(self.ts.shape[0])

    @classmethod
    def empty(cls) -> "Candles":
        return cls.from_columns({name: [] for name in COLUMNS})

    @classmethod
    def from_columns(cls, columns: Mapping[str, Iterable]) -> "Candles":
        volume = columns.get("volume")
        ts = np.asarray(columns["ts"], dtype=np.int64)
        return cls(
            ts=ts,
            open=np.asarray(columns["open"], dtype=np.float64),
            high=np.asarray(columns["high"], dtype=np.float64),
            low=np.asarray(columns["low"], dtype=np.float64),
            close=np.asarray(columns["close"], dtype=np.float64),
            volume=np.zeros(ts.shape[0]) if volume is None else np.asarray(volume, dtype=np.float64),
        )

    @classmethod
    def from_rows(cls, rows: Iterable[tuple]) -> "Candles":
        """Rows of (ts_ms, open, high, low, close[, volume])."""
        materialized = [tuple(row) + (0.0,) * (6 - len(row)) for row in rows]
        if not materialized:
            return cls.empty()
        return cls.from_columns(dict(zip(COLUMNS, zip(*materialized))))

    @classmethod
    def from_arrow(cls, table: pa.Table) -> "Candles":
        return cls.from_columns({name: table.column(name).to_numpy() for name in COLUMNS})

    def to_arrow(self) -> pa.Table:
        return pa.table({name: getattr(self, name) for name in COLUMNS}, schema=ARROW_SCHEMA)

    def take(self, index: np.ndarray) -> "Candles":
        return Candles(*(getattr(self, name)[index] for name in COLUMNS))

    def between(self, start_ms: int, end_ms: int) -> "Candles":
        return self.take((self.ts >= start_ms) & (self.ts < end_ms))

    @staticmethod
    def concat(*batches: "Candles") -> "Candles":
        present = [b for b in batches if len(b)]
        if not present:
            return Candles.empty()
        return Candles(*(np.concatenate([getattr(b, name) for b in present]) for name in COLUMNS))

    def rows(self) -> list[tuple[int, float, float, float, float, float]]:
        return list(zip(self.ts.tolist(), self.open.tolist(), self.high.tolist(), self.low.tolist(), self.close.tolist(), self.volume.tolist()))
