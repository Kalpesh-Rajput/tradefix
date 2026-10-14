"""DuckDB aggregation vs an independent pure-Python calculation (backtesting 1G)."""

from __future__ import annotations

import os
import random
from collections import defaultdict
from datetime import datetime, timezone

import pytest

from app.services.marketdata.aggregation import TIMEFRAME_MINUTES, aggregate, timeframe_ms
from app.services.marketdata.candles import MINUTE_MS, Candles
from app.services.marketdata.store import LocalParquetStore

SEED = int(os.environ.get("BT_SEED", "4242"))
START = int(datetime(2026, 2, 26, tzinfo=timezone.utc).timestamp() * 1000)
DAYS = 4


def _series(rng: random.Random) -> Candles:
    rows, price = [], 100.0
    for i in range(DAYS * 1440):
        if rng.random() < 0.03:
            continue
        o = price
        c = round(o + rng.uniform(-0.5, 0.5), 4)
        h = round(max(o, c) + rng.uniform(0, 0.3), 4)
        lo = round(min(o, c) - rng.uniform(0, 0.3), 4)
        rows.append((START + i * MINUTE_MS, o, h, lo, c, float(rng.randint(1, 50))))
        price = c
    return Candles.from_rows(rows)


def _reference(candles: Candles, step: int) -> dict[int, tuple]:
    buckets: dict[int, list[tuple]] = defaultdict(list)
    for row in candles.rows():
        buckets[row[0] // step * step].append(row)
    out = {}
    for start, rows in buckets.items():
        rows.sort()
        out[start] = (rows[0][1], max(r[2] for r in rows), min(r[3] for r in rows), rows[-1][4], sum(r[5] for r in rows))
    return out


@pytest.fixture(scope="module")
def seeded(tmp_path_factory):
    rng = random.Random(SEED)
    store = LocalParquetStore(tmp_path_factory.mktemp("agg"))
    candles = _series(rng)
    store.write("binance", "BTCUSDT", candles)
    return store, candles


@pytest.mark.parametrize("timeframe", ["5m", "15m", "30m", "1h", "4h", "1d"])
def test_aggregation_matches_python(seeded, timeframe):
    store, candles = seeded
    step = timeframe_ms(timeframe)
    got = aggregate(store, "binance", "BTCUSDT", timeframe, START, START + DAYS * 86_400_000)
    expected = _reference(candles, step)
    assert got.ts.tolist() == sorted(expected), f"seed={SEED}"
    rng = random.Random(SEED + TIMEFRAME_MINUTES[timeframe])
    sample = rng.sample(range(len(got)), min(40, len(got)))
    for index in sample:
        bucket = int(got.ts[index])
        assert bucket % step == 0
        row = (float(got.open[index]), float(got.high[index]), float(got.low[index]), float(got.close[index]), float(got.volume[index]))
        assert row == expected[bucket], f"seed={SEED} bucket={bucket}"


def test_daily_and_4h_buckets_align_to_utc_midnight(seeded):
    store, _ = seeded
    daily = aggregate(store, "binance", "BTCUSDT", "1d", START, START + DAYS * 86_400_000)
    assert [datetime.fromtimestamp(t / 1000, tz=timezone.utc).hour for t in daily.ts.tolist()] == [0] * DAYS
    four = aggregate(store, "binance", "BTCUSDT", "4h", START, START + 86_400_000)
    assert [datetime.fromtimestamp(t / 1000, tz=timezone.utc).hour for t in four.ts.tolist()] == [0, 4, 8, 12, 16, 20]


def test_month_boundary_spans_two_files(seeded):
    store, candles = seeded
    march = int(datetime(2026, 3, 1, tzinfo=timezone.utc).timestamp() * 1000)
    assert len(store.files_for("binance", "BTCUSDT", march - 86_400_000, march + 86_400_000)) == 2
    got = aggregate(store, "binance", "BTCUSDT", "1d", march - 86_400_000, march + 86_400_000)
    expected = _reference(candles.between(march - 86_400_000, march + 86_400_000), 86_400_000)
    assert got.ts.tolist() == sorted(expected)


def test_one_minute_reads_directly(seeded):
    store, candles = seeded
    got = aggregate(store, "binance", "BTCUSDT", "1m", START, START + 3600_000)
    assert got.ts.tolist() == candles.between(START, START + 3600_000).ts.tolist()
    with pytest.raises(ValueError):
        timeframe_ms("2h")
