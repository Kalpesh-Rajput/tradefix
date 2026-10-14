"""Operator workflows behind the market-data CLI and admin API: backfill, top-up, seed, coverage, verify."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone

import pyarrow.parquet as pq
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.market_data import CandleMonthStat
from app.services.marketdata.candles import COLUMNS, MINUTE_MS, Candles
from app.services.marketdata.coverage import Range, covered_ranges, find_gaps, refresh_month_stat
from app.services.marketdata.ingest_jobs import DAY_MS, ProviderFactory, default_provider, enqueue_ingest, fill_gaps
from app.services.marketdata.providers import ProviderError
from app.services.marketdata.registry import InstrumentSpec, enabled_instruments, get_instrument
from app.services.marketdata.store import CandleStore, LocalParquetStore, get_store, month_bounds, months_between
from app.services.marketdata.validation import gap_summary, validate_batch

logger = logging.getLogger(__name__)

SEED_SYMBOLS = ("BTCUSDT", "EURUSD", "XAUUSD")


def _now_ms() -> int:
    return int(time.time() * 1000)


def last_closed_day_end(now_ms: int | None = None) -> int:
    now = _now_ms() if now_ms is None else now_ms
    return now - now % DAY_MS


def previous_full_month(now_ms: int | None = None) -> Range:
    now = datetime.fromtimestamp((_now_ms() if now_ms is None else now_ms) / 1000, tz=timezone.utc)
    year, month = (now.year, now.month - 1) if now.month > 1 else (now.year - 1, 12)
    return month_bounds(year, month)


def preload_range(spec: InstrumentSpec, now_ms: int | None = None) -> Range:
    end = last_closed_day_end(now_ms)
    moment = datetime.fromtimestamp(end / 1000, tz=timezone.utc)
    start = moment.replace(year=moment.year - spec.preload_years, day=1)
    return int(start.timestamp() * 1000), end


@dataclass
class BackfillResult:
    symbol: str
    requested: Range
    gaps: list[Range]
    rows: int = 0
    chunks: int = 0
    job_id: str | None = None
    error: str | None = None

    @property
    def missing_minutes(self) -> int:
        return sum(b - a for a, b in self.gaps) // MINUTE_MS


def backfill(
    db: Session,
    spec: InstrumentSpec,
    start_ms: int,
    end_ms: int,
    *,
    enqueue: bool = False,
    store: CandleStore | None = None,
    provider_factory: ProviderFactory = default_provider,
    progress=None,
) -> BackfillResult:
    """Fetch only what coverage says is missing. Safe to rerun: a finished range yields no gaps."""
    gaps = find_gaps(db, spec.symbol, spec.source, start_ms, end_ms)
    result = BackfillResult(spec.symbol, (start_ms, end_ms), gaps)
    if not gaps:
        return result
    if enqueue:
        enqueued = enqueue_ingest(db, spec, gaps[0][0], gaps[-1][1])
        db.commit()
        result.job_id = str(enqueued.job.id)
        return result
    try:
        done = fill_gaps(db, spec, gaps, store=store, provider=provider_factory(spec.source), on_chunk=progress)
    except ProviderError as exc:
        db.rollback()
        result.error = f"{exc.code}: {exc}"
        logger.warning("backfill stopped", extra={"symbol": spec.symbol, "code": exc.code})
        return result
    result.rows, result.chunks = done["rows"], done["chunks"]
    return result


def top_up(
    db: Session,
    *,
    store: CandleStore | None = None,
    provider_factory: ProviderFactory = default_provider,
    now_ms: int | None = None,
    specs: list[InstrumentSpec] | None = None,
) -> list[dict]:
    """From each enabled instrument's last covered minute up to the last closed UTC day, sequentially."""
    end = last_closed_day_end(now_ms)
    summary = []
    for spec in specs if specs is not None else enabled_instruments():
        covered = covered_ranges(db, spec.symbol, spec.source)
        if not covered:
            summary.append({"symbol": spec.symbol, "status": "skipped", "reason": "no coverage yet; run backfill"})
            continue
        start = covered[-1][1]
        if start >= end:
            summary.append({"symbol": spec.symbol, "status": "up_to_date"})
            continue
        result = backfill(db, spec, start, end, store=store, provider_factory=provider_factory)
        status = "failed" if result.error else "updated"
        summary.append({"symbol": spec.symbol, "status": status, "rows": result.rows, "error": result.error})
    logger.info("top-up finished", extra={"summary": summary})
    return summary


def seed_demo(
    db: Session,
    *,
    store: CandleStore | None = None,
    provider_factory: ProviderFactory = default_provider,
    now_ms: int | None = None,
) -> list[BackfillResult]:
    start, end = previous_full_month(now_ms)
    results = []
    for symbol in SEED_SYMBOLS:
        spec = get_instrument(symbol)
        if spec is None:
            continue
        results.append(backfill(db, spec, start, end, store=store, provider_factory=provider_factory))
    return results


@dataclass
class CoverageReport:
    symbol: str
    source: str
    ranges: list[dict]
    holes: list[Range]
    months: list[dict]


def coverage_report(db: Session, spec: InstrumentSpec) -> CoverageReport:
    covered = covered_ranges(db, spec.symbol, spec.source)
    holes = [(covered[i][1], covered[i + 1][0]) for i in range(len(covered) - 1)]
    stats = db.scalars(
        select(CandleMonthStat)
        .where(CandleMonthStat.instrument == spec.symbol, CandleMonthStat.source == spec.source)
        .order_by(CandleMonthStat.year, CandleMonthStat.month)
    )
    return CoverageReport(
        symbol=spec.symbol,
        source=spec.source,
        ranges=[{"from": a, "to": b} for a, b in covered],
        holes=holes,
        months=[
            {
                "month": f"{s.year:04d}-{s.month:02d}",
                "rows": s.row_count,
                "gap_minutes": s.gap_minutes,
                "outliers": s.outliers,
                "expected_minutes": (s.detail or {}).get("expected_minutes"),
            }
            for s in stats
        ],
    )


@dataclass
class MonthCheck:
    month: str
    rows: int
    gap_minutes: int = 0
    problems: list[str] = field(default_factory=list)


def verify_stored(db: Session, spec: InstrumentSpec, store: LocalParquetStore | None = None) -> list[MonthCheck]:
    """Re-validate each stored month file as written on disk and refresh its stats row."""
    store = store or get_store()
    covered = covered_ranges(db, spec.symbol, spec.source)
    if not covered:
        return []
    checks = []
    for year, month in months_between(covered[0][0], covered[-1][1]):
        path = store.month_path(spec.source, spec.symbol, year, month)
        check = MonthCheck(f"{year:04d}-{month:02d}", 0)
        if not path.exists():
            check.problems.append("covered but no file on disk")
            checks.append(check)
            continue
        try:
            raw = Candles.from_arrow(pq.read_table(path, columns=list(COLUMNS)))
        except Exception as exc:
            check.problems.append(f"unreadable file: {exc}")
            checks.append(check)
            continue
        check.rows = len(raw)
        clean, report = validate_batch(raw, symbol=spec.symbol)
        if report.rejected_total:
            check.problems.append(f"invalid rows: {report.rejected}")
        if report.duplicates:
            check.problems.append(f"{report.duplicates} duplicate timestamps")
        if len(raw) > 1 and bool((raw.ts[1:] <= raw.ts[:-1]).any()):
            check.problems.append("timestamps not strictly increasing")
        month_start, month_end = month_bounds(year, month)
        if len(raw) and (raw.ts.min() < month_start or raw.ts.max() >= month_end):
            check.problems.append("rows outside the file's month")
        for a, b in covered:
            lo, hi = max(a, month_start), min(b, month_end)
            if lo < hi:
                check.gap_minutes += gap_summary(clean.ts, spec.asset_class, lo, hi).missing_minutes
        refresh_month_stat(db, store, spec, year, month)
        checks.append(check)
    db.commit()
    return checks
