"""Batch validation before every store write (backtesting/02 sections 1 and 8)."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import numpy as np
from numpy.lib.stride_tricks import sliding_window_view

from app.core.config import settings
from app.services.marketdata.candles import MINUTE_MS, Candles

logger = logging.getLogger(__name__)

OUTLIER_WINDOW = 60
OUTLIER_MIN_RANGE_FRACTION = 1e-4
MAX_GAP_RANGES = 50
_NEW_YORK = ZoneInfo("America/New_York")
_DAILY_BREAK_CLASSES = {"metal", "index"}


@dataclass
class ValidationReport:
    received: int = 0
    kept: int = 0
    duplicates: int = 0
    rejected: dict[str, int] = field(default_factory=dict)
    outliers: list[int] = field(default_factory=list)

    @property
    def rejected_total(self) -> int:
        return sum(self.rejected.values())


@dataclass(frozen=True)
class GapSummary:
    expected_minutes: int
    missing_minutes: int
    ranges: list[tuple[int, int]]


def _rule_failures(batch: Candles) -> dict[str, np.ndarray]:
    prices = np.vstack([batch.open, batch.high, batch.low, batch.close])
    return {
        "non_finite": ~np.isfinite(prices).all(axis=0) | ~np.isfinite(batch.volume),
        "non_positive": (prices <= 0).any(axis=0),
        "high_below_body": batch.high < np.maximum(batch.open, batch.close),
        "low_above_body": batch.low > np.minimum(batch.open, batch.close),
        "unaligned": batch.ts % MINUTE_MS != 0,
        "negative_volume": batch.volume < 0,
    }


def _dedup_keep_last(batch: Candles) -> tuple[Candles, int]:
    reversed_ts = batch.ts[::-1]
    _, first_in_reversed = np.unique(reversed_ts, return_index=True)
    keep = (len(batch) - 1 - first_in_reversed)
    keep.sort()
    deduped = batch.take(keep)
    order = np.argsort(deduped.ts, kind="stable")
    return deduped.take(order), len(batch) - len(keep)


def flag_outliers(batch: Candles, multiple: float | None = None, window: int = OUTLIER_WINDOW) -> list[int]:
    """Timestamps whose range exceeds `multiple` x the median range of the preceding `window` bars.

    The median is floored at OUTLIER_MIN_RANGE_FRACTION of price: quiet markets pinned to one tick
    otherwise turn ordinary bars into "outliers"."""
    multiple = multiple or settings.candle_outlier_range_multiple
    ranges = batch.high - batch.low
    if len(ranges) <= 1:
        return []
    medians = np.full(len(ranges), np.nan)
    warmup = min(window, len(ranges))
    for index in range(1, warmup):
        medians[index] = np.median(ranges[:index])
    if len(ranges) > window:
        medians[window:] = np.median(sliding_window_view(ranges, window)[:-1], axis=1)
    baseline = np.maximum(medians, np.abs(batch.close) * OUTLIER_MIN_RANGE_FRACTION)
    flagged = (medians > 0) & (ranges > multiple * baseline)
    return batch.ts[flagged].tolist()


def validate_batch(batch: Candles, *, symbol: str = "", outlier_multiple: float | None = None) -> tuple[Candles, ValidationReport]:
    """Drop rule-breaking rows, dedup keeping the later fetch, sort, and flag (but keep) outliers."""
    report = ValidationReport(received=len(batch))
    if not len(batch):
        return batch, report
    failures = _rule_failures(batch)
    bad = np.zeros(len(batch), dtype=bool)
    for reason, mask in failures.items():
        count = int(mask.sum())
        if count:
            report.rejected[reason] = count
            bad |= mask
    clean = batch.take(~bad)
    clean, report.duplicates = _dedup_keep_last(clean)
    report.outliers = flag_outliers(clean, outlier_multiple)
    report.kept = len(clean)
    if report.rejected:
        logger.warning("candles rejected", extra={"symbol": symbol, "rejected": report.rejected})
    if report.outliers:
        logger.info("candle outliers flagged", extra={"symbol": symbol, "outliers": len(report.outliers)})
    return clean, report


def _ms(moment: datetime) -> int:
    return int(moment.timestamp() * 1000)


def closed_windows(asset_class: str, start_ms: int, end_ms: int) -> list[tuple[int, int]]:
    """Market-closed UTC windows: the Friday 17:00 to Sunday 17:00 New York weekend, plus the daily
    17:00 to 18:00 New York break for metals and indices. Crypto never closes."""
    if asset_class == "crypto" or end_ms <= start_ms:
        return []
    windows: list[tuple[int, int]] = []
    first = datetime.fromtimestamp(start_ms / 1000, tz=timezone.utc).astimezone(_NEW_YORK).date() - timedelta(days=7)
    last = datetime.fromtimestamp(end_ms / 1000, tz=timezone.utc).astimezone(_NEW_YORK).date() + timedelta(days=1)
    day = first
    while day <= last:
        five_pm = datetime(day.year, day.month, day.day, 17, tzinfo=_NEW_YORK)
        if day.weekday() == 4:
            windows.append((_ms(five_pm), _ms(five_pm + timedelta(days=2))))
        elif asset_class in _DAILY_BREAK_CLASSES and day.weekday() in (0, 1, 2, 3):
            windows.append((_ms(five_pm), _ms(five_pm + timedelta(hours=1))))
        day += timedelta(days=1)
    return [(max(a, start_ms), min(b, end_ms)) for a, b in windows if b > start_ms and a < end_ms]


def gap_summary(ts: np.ndarray, asset_class: str, start_ms: int, end_ms: int) -> GapSummary:
    """Missing minutes inside open-market periods of [start_ms, end_ms)."""
    start_ms -= start_ms % MINUTE_MS
    if end_ms <= start_ms:
        return GapSummary(0, 0, [])
    expected = np.arange(start_ms, end_ms, MINUTE_MS, dtype=np.int64)
    open_mask = np.ones(expected.shape[0], dtype=bool)
    for a, b in closed_windows(asset_class, start_ms, end_ms):
        open_mask &= ~((expected >= a) & (expected < b))
    expected = expected[open_mask]
    missing = expected[~np.isin(expected, ts)]
    ranges: list[tuple[int, int]] = []
    if missing.size:
        breaks = np.flatnonzero(np.diff(missing) != MINUTE_MS)
        starts = np.concatenate([[0], breaks + 1])
        ends = np.concatenate([breaks, [missing.size - 1]])
        ranges = [(int(missing[s]), int(missing[e]) + MINUTE_MS) for s, e in zip(starts[:MAX_GAP_RANGES], ends[:MAX_GAP_RANGES])]
    return GapSummary(int(expected.size), int(missing.size), ranges)
