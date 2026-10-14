"""Timeframe aggregation from stored 1m candles in DuckDB (backtesting/02 section 9.2).

Buckets align to UTC epoch boundaries, so 1d buckets start at 00:00 UTC and 4h buckets at 00/04/08/... UTC.
Per bucket: first open, max high, min low, last close, summed volume.
"""

from __future__ import annotations

from app.services.marketdata.candles import MINUTE_MS, Candles
from app.services.marketdata.store import CandleStore, duckdb_query

TIMEFRAME_MINUTES: dict[str, int] = {"1m": 1, "5m": 5, "15m": 15, "30m": 30, "1h": 60, "4h": 240, "1d": 1440}


def timeframe_ms(timeframe: str) -> int:
    try:
        return TIMEFRAME_MINUTES[timeframe] * MINUTE_MS
    except KeyError as exc:
        raise ValueError(f"unsupported timeframe {timeframe}") from exc


def floor_to(ts_ms: int, step_ms: int) -> int:
    return ts_ms - ts_ms % step_ms


def ceil_to(ts_ms: int, step_ms: int) -> int:
    return -(-ts_ms // step_ms) * step_ms


def aggregate(store: CandleStore, source: str, symbol: str, timeframe: str, start_ms: int, end_ms: int) -> Candles:
    """All buckets with at least one stored minute in [start, end) (bounds aligned to the timeframe).

    Completeness is decided by the caller (`candle_service.get_candles`)."""
    step = timeframe_ms(timeframe)
    start, end = floor_to(start_ms, step), ceil_to(end_ms, step)
    if step == MINUTE_MS:
        return store.read(source, symbol, start, end)
    files = store.files_for(source, symbol, start, end)
    if not files:
        return Candles.empty()
    result = duckdb_query(
        "SELECT ts - (ts % $step) AS ts, arg_min(open, ts) AS open, max(high) AS high, min(low) AS low, "
        "arg_max(close, ts) AS close, sum(volume) AS volume "
        "FROM read_parquet($files) WHERE ts >= $start AND ts < $end GROUP BY 1 ORDER BY 1",
        {"files": files, "step": step, "start": start, "end": end},
    )
    return Candles.from_columns(result)
