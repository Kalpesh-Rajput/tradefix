"""Candle validation and gap summary (backtesting 1D)."""

from __future__ import annotations

from datetime import datetime, timezone

import numpy as np

from app.services.marketdata.candles import MINUTE_MS, Candles
from app.services.marketdata.validation import closed_windows, flag_outliers, gap_summary, validate_batch


def _ms(*args) -> int:
    return int(datetime(*args, tzinfo=timezone.utc).timestamp() * 1000)


T0 = _ms(2026, 3, 4, 10, 0)


def _flat(n: int, start: int = T0, price: float = 100.0) -> Candles:
    ts = start + np.arange(n) * MINUTE_MS
    return Candles.from_columns({"ts": ts, "open": [price] * n, "high": [price + 1] * n, "low": [price - 1] * n, "close": [price] * n, "volume": [1.0] * n})


def test_rule_violations_are_rejected_with_reasons():
    batch = Candles.from_rows(
        [
            (T0, 1.0, 1.2, 0.9, 1.1, 5),
            (T0 + MINUTE_MS, 1.0, 1.05, 0.9, 1.1, 5),
            (T0 + 2 * MINUTE_MS, 1.0, 1.2, 1.05, 1.1, 5),
            (T0 + 3 * MINUTE_MS, -1.0, 1.2, 0.9, 1.1, 5),
            (T0 + 4 * MINUTE_MS + 30_000, 1.0, 1.2, 0.9, 1.1, 5),
            (T0 + 5 * MINUTE_MS, float("nan"), 1.2, 0.9, 1.1, 5),
            (T0 + 6 * MINUTE_MS, 1.0, 1.2, 0.9, 1.1, -3),
        ]
    )
    clean, report = validate_batch(batch)
    assert clean.ts.tolist() == [T0]
    assert report.rejected == {
        "non_finite": 1,
        "non_positive": 1,
        "high_below_body": 1,
        "low_above_body": 2,
        "unaligned": 1,
        "negative_volume": 1,
    }
    assert report.kept == 1 and report.received == 7


def test_dedup_keeps_later_fetch_and_sorts():
    batch = Candles.from_rows(
        [
            (T0 + MINUTE_MS, 1, 2, 0.5, 1.5, 1),
            (T0, 1, 2, 0.5, 1.0, 1),
            (T0 + MINUTE_MS, 1, 2, 0.5, 1.9, 9),
        ]
    )
    clean, report = validate_batch(batch)
    assert clean.ts.tolist() == [T0, T0 + MINUTE_MS]
    assert clean.close.tolist() == [1.0, 1.9]
    assert report.duplicates == 1
    assert np.all(np.diff(clean.ts) > 0)


def test_outliers_flagged_but_kept():
    batch = _flat(120)
    high = batch.high.copy()
    high[90] = 160.0
    spiky = Candles(batch.ts, batch.open, high, batch.low, batch.close, batch.volume)
    clean, report = validate_batch(spiky, outlier_multiple=20)
    assert report.outliers == [int(batch.ts[90])]
    assert len(clean) == 120
    assert flag_outliers(batch, 20) == []


def test_tick_pinned_quiet_market_does_not_flag_ordinary_bars():
    n = 90
    ts = T0 + np.arange(n, dtype=np.int64) * MINUTE_MS
    close = np.full(n, 79692.51)
    high, low = close.copy(), close - 0.01
    low[70] = close[70] - 8.0
    high[80] = close[80] + 900.0
    quiet = Candles(ts, close.copy(), high, low, close, np.ones(n))
    assert flag_outliers(quiet, 20) == [int(ts[80])]


def test_gap_summary_crypto_counts_every_missing_minute():
    batch = _flat(60)
    keep = np.ones(60, dtype=bool)
    keep[[10, 11, 12, 40]] = False
    summary = gap_summary(batch.ts[keep], "crypto", T0, T0 + 60 * MINUTE_MS)
    assert summary.expected_minutes == 60
    assert summary.missing_minutes == 4
    assert summary.ranges == [(T0 + 10 * MINUTE_MS, T0 + 13 * MINUTE_MS), (T0 + 40 * MINUTE_MS, T0 + 41 * MINUTE_MS)]


def test_forex_weekend_is_not_a_gap_and_follows_new_york_dst():
    winter = closed_windows("forex", _ms(2026, 1, 5), _ms(2026, 1, 12))
    assert (_ms(2026, 1, 9, 22), _ms(2026, 1, 11, 22)) in winter
    summer = closed_windows("forex", _ms(2026, 7, 6), _ms(2026, 7, 13))
    assert (_ms(2026, 7, 10, 21), _ms(2026, 7, 12, 21)) in summer
    friday_close = _ms(2026, 1, 9, 21, 0)
    sunday_open = _ms(2026, 1, 11, 23, 0)
    ts = np.concatenate([
        np.arange(friday_close, _ms(2026, 1, 9, 22), MINUTE_MS),
        np.arange(_ms(2026, 1, 11, 22), sunday_open, MINUTE_MS),
    ])
    summary = gap_summary(ts, "forex", friday_close, sunday_open)
    assert summary.missing_minutes == 0
    assert summary.expected_minutes == 120
    assert gap_summary(ts, "crypto", friday_close, sunday_open).missing_minutes == 48 * 60


def test_metals_and_indices_have_a_daily_break():
    tuesday = _ms(2026, 1, 6)
    windows = closed_windows("metal", tuesday, tuesday + 24 * 3600_000)
    assert (_ms(2026, 1, 6, 22), _ms(2026, 1, 6, 23)) in windows
    assert closed_windows("forex", tuesday, tuesday + 24 * 3600_000) == []
    assert closed_windows("crypto", tuesday, tuesday + 7 * 24 * 3600_000) == []
