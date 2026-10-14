"""Coverage tracking (backtesting/02 section 5): which [start, end) epoch-ms ranges were fully fetched.

Coverage means "we asked the provider for this range and stored what it had", so weekends count as
covered. Coverage changes only after the month files were written (`record_fetch`).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from sqlalchemy import delete, func, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.market_data import CandleCoverage, CandleMonthStat
from app.services.marketdata.candles import MINUTE_MS, Candles
from app.services.marketdata.registry import InstrumentSpec
from app.services.marketdata.store import CandleStore, month_bounds, months_between
from app.services.marketdata.validation import MAX_GAP_RANGES, ValidationReport, flag_outliers, gap_summary, validate_batch

logger = logging.getLogger(__name__)

Range = tuple[int, int]


def merge_ranges(ranges: list[Range]) -> list[Range]:
    """Sort and merge overlapping or touching half-open ranges; empty ranges are dropped."""
    merged: list[list[int]] = []
    for start, end in sorted(r for r in ranges if r[1] > r[0]):
        if merged and start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return [(a, b) for a, b in merged]


def subtract_ranges(request: Range, covered: list[Range]) -> list[Range]:
    """Parts of `request` not inside any covered range."""
    start, end = request
    gaps: list[Range] = []
    cursor = start
    for a, b in merge_ranges(covered):
        if b <= cursor or a >= end:
            continue
        if a > cursor:
            gaps.append((cursor, a))
        cursor = max(cursor, b)
        if cursor >= end:
            break
    if cursor < end:
        gaps.append((cursor, end))
    return gaps


def align_range(start_ms: int, end_ms: int) -> Range:
    """Widen to whole minutes: floor the start, ceil the end."""
    return start_ms - start_ms % MINUTE_MS, -(-end_ms // MINUTE_MS) * MINUTE_MS


def _lock(db: Session, symbol: str, source: str) -> None:
    db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:key))"), {"key": f"coverage:{source}:{symbol}"})


def covered_ranges(db: Session, symbol: str, source: str) -> list[Range]:
    rows = db.execute(
        select(CandleCoverage.covered_from, CandleCoverage.covered_to)
        .where(CandleCoverage.instrument == symbol, CandleCoverage.source == source)
        .order_by(CandleCoverage.covered_from)
    ).all()
    return [(int(a), int(b)) for a, b in rows]


def find_gaps(db: Session, symbol: str, source: str, start_ms: int, end_ms: int) -> list[Range]:
    return subtract_ranges(align_range(start_ms, end_ms), covered_ranges(db, symbol, source))


def mark_covered(db: Session, store: CandleStore, symbol: str, source: str, start_ms: int, end_ms: int) -> list[Range]:
    """Merge [start, end) into the coverage rows and recount stored rows per merged range."""
    _lock(db, symbol, source)
    ranges = merge_ranges([*covered_ranges(db, symbol, source), align_range(start_ms, end_ms)])
    db.execute(delete(CandleCoverage).where(CandleCoverage.instrument == symbol, CandleCoverage.source == source))
    for a, b in ranges:
        db.add(
            CandleCoverage(
                instrument=symbol, source=source, covered_from=a, covered_to=b, row_count=store.count(source, symbol, a, b)
            )
        )
    db.flush()
    return ranges


def reset_coverage(db: Session, symbol: str | None = None) -> int:
    stmt = delete(CandleCoverage)
    if symbol:
        stmt = stmt.where(CandleCoverage.instrument == symbol)
    return db.execute(stmt).rowcount or 0


def refresh_month_stat(db: Session, store: CandleStore, spec: InstrumentSpec, year: int, month: int) -> CandleMonthStat | None:
    """Recompute row count, open-market gap minutes and outliers for one month over its covered part."""
    month_start, month_end = month_bounds(year, month)
    covered = [
        (max(a, month_start), min(b, month_end))
        for a, b in covered_ranges(db, spec.symbol, spec.source)
        if b > month_start and a < month_end
    ]
    if not covered:
        return None
    stored = store.read(spec.source, spec.symbol, month_start, month_end)
    expected = missing = 0
    gap_ranges: list[Range] = []
    for a, b in covered:
        summary = gap_summary(stored.ts, spec.asset_class, a, b)
        expected += summary.expected_minutes
        missing += summary.missing_minutes
        gap_ranges.extend(summary.ranges)
    detail = {
        "covered": [list(r) for r in covered],
        "expected_minutes": expected,
        "gap_ranges": [list(r) for r in gap_ranges[:MAX_GAP_RANGES]],
    }
    table = CandleMonthStat.__table__
    stmt = insert(table).values(
        instrument=spec.symbol,
        source=spec.source,
        year=year,
        month=month,
        row_count=len(stored),
        gap_minutes=missing,
        outliers=len(flag_outliers(stored)),
        detail=detail,
    )
    db.execute(
        stmt.on_conflict_do_update(
            constraint="uq_candle_month",
            set_={
                "row_count": stmt.excluded.row_count,
                "gap_minutes": stmt.excluded.gap_minutes,
                "outliers": stmt.excluded.outliers,
                "detail": stmt.excluded.detail,
                "updated_at": func.now(),
            },
        )
    )
    return db.scalar(
        select(CandleMonthStat).where(
            CandleMonthStat.instrument == spec.symbol,
            CandleMonthStat.source == spec.source,
            CandleMonthStat.year == year,
            CandleMonthStat.month == month,
        )
    )


@dataclass(frozen=True)
class FetchResult:
    rows_kept: int
    months: list[tuple[int, int]]
    report: ValidationReport
    coverage: list[Range]


def record_fetch(
    db: Session, store: CandleStore, spec: InstrumentSpec, start_ms: int, end_ms: int, batch: Candles
) -> FetchResult:
    """Validate, write month files, then (only on success) mark [start, end) covered and refresh stats.

    A store failure propagates before any coverage change. Rows outside [start, end) are dropped so
    coverage never claims more than was asked for."""
    start_ms, end_ms = align_range(start_ms, end_ms)
    clean, report = validate_batch(batch.between(start_ms, end_ms), symbol=spec.symbol)
    store.write(spec.source, spec.symbol, clean)
    coverage = mark_covered(db, store, spec.symbol, spec.source, start_ms, end_ms)
    months = months_between(start_ms, end_ms)
    for year, month in months:
        refresh_month_stat(db, store, spec, year, month)
    logger.info(
        "candles recorded",
        extra={"symbol": spec.symbol, "rows": report.kept, "rejected": report.rejected_total, "months": len(months)},
    )
    return FetchResult(report.kept, months, report, coverage)
