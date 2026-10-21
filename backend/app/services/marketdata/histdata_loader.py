"""Load HistData.com 1-minute ASCII archives from symbol folders into the candle store. No network access.

Layout: ``<root>/<FOLDER>/HISTDATA_COM_ASCII_<FOLDER>_M1<period>.zip`` where the period is a year
(``2019``) or a year and month (``20269`` or ``202609``). Each archive is imported through the same
importer as ``import-candles``, so validation, coverage, month stats and provenance behave identically.

HistData stamps bars in EST with no daylight saving (UTC-5). Each archive states its whole period, so
the covered range reaches the period edges; the first archive keeps its first bar as the start and the
last archive keeps its last bar as the end, so nothing past the real data is claimed.
"""

from __future__ import annotations

import logging
import re
import shutil
from concurrent.futures import ProcessPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import delete

from app.models.market_data import CandleCoverage, CandleImport, CandleMonthStat
from app.services.marketdata.histdata_catalog import CatalogEntry, entry_for, to_spec
from app.services.marketdata.importer import CandleImportError, import_candles
from app.services.marketdata.registry import (
    InstrumentSpec,
    add_instruments,
    get_instrument,
    mark_disabled,
    mirror_to_db,
    reload_registry,
)
from app.services.marketdata.store import LocalParquetStore, get_store

logger = logging.getLogger(__name__)

LABEL = "HistData.com M1 ASCII"
PRICE_SIDE = "bid"
_EST = timezone(timedelta(hours=-5))
_PERIOD = re.compile(r"_M1(\d{4})(\d{1,2})?\.zip$", re.IGNORECASE)


@dataclass(frozen=True)
class Archive:
    path: Path
    year: int
    month: int | None

    @property
    def sort_key(self) -> tuple[int, int]:
        return self.year, self.month or 0

    def bounds_ms(self) -> tuple[int, int]:
        start = datetime(self.year, self.month or 1, 1, tzinfo=_EST)
        end = datetime(self.year + (self.month in (None, 12)), 1 if self.month in (None, 12) else self.month + 1, 1, tzinfo=_EST)
        return int(start.timestamp() * 1000), int(end.timestamp() * 1000)


@dataclass
class SymbolResult:
    folder: str
    symbol: str
    archives: int = 0
    imported: int = 0
    duplicates: int = 0
    rows: int = 0
    failures: list[str] = field(default_factory=list)


def parse_archive(path: Path) -> Archive | None:
    match = _PERIOD.search(path.name)
    if match is None:
        return None
    year = int(match.group(1))
    month = int(match.group(2)) if match.group(2) else None
    if month is not None and not 1 <= month <= 12:
        return None
    return Archive(path, year, month)


def find_archives(root: Path, symbols: list[str] | None = None) -> tuple[dict[str, list[Archive]], list[str]]:
    """Archives per folder, plus the folders and files that were skipped and why."""
    wanted = {s.strip().upper() for s in symbols or [] if s.strip()}
    found: dict[str, list[Archive]] = {}
    skipped: list[str] = []
    for folder in sorted(p for p in root.iterdir() if p.is_dir()):
        key = folder.name.upper()
        entry = entry_for(key)
        if entry is None:
            skipped.append(f"{folder.name}: not a recognised instrument folder")
            continue
        if wanted and key not in wanted and entry.symbol not in wanted:
            continue
        archives = []
        for path in sorted(folder.glob("*.zip")):
            archive = parse_archive(path)
            if archive is None:
                skipped.append(f"{path.name}: period not recognised")
                continue
            archives.append(archive)
        if archives:
            found[key] = sorted(archives, key=lambda a: a.sort_key)
    return found, skipped


def register(folders: list[str]) -> list[CatalogEntry]:
    """Add any missing instruments to the registry (disabled until verified) and mirror them to the database."""
    from app.core.db import SessionLocal

    entries = [entry for entry in (entry_for(folder) for folder in folders) if entry is not None]
    added = add_instruments([to_spec(entry) for entry in entries])
    if added:
        logger.info("registered %d instrument(s): %s", len(added), ", ".join(added))
    reload_registry()
    with SessionLocal() as db:
        mirror_to_db(db)
    return entries


def purge(db, spec: InstrumentSpec, store: LocalParquetStore | None = None) -> None:
    """Forget stored candles, coverage, month stats and import history for one instrument."""
    store = store or get_store()
    for model in (CandleCoverage, CandleMonthStat, CandleImport):
        db.execute(delete(model).where(model.instrument == spec.symbol))
    db.commit()
    shutil.rmtree(store.candles_dir / spec.source / spec.symbol, ignore_errors=True)


def load_symbol(folder: str, archives: list[Archive], reset: bool = False) -> SymbolResult:
    """Import every archive of one folder, oldest first. Safe to run again: unchanged archives are skipped."""
    from app.core.db import SessionLocal

    entry = entry_for(folder)
    spec = get_instrument(entry.symbol) if entry else None
    result = SymbolResult(folder, entry.symbol if entry else folder, archives=len(archives))
    if spec is None:
        result.failures.append("instrument is not in the registry")
        return result
    last = len(archives) - 1
    with SessionLocal() as db:
        if reset:
            purge(db, spec)
        for index, archive in enumerate(archives):
            start, end = archive.bounds_ms()
            try:
                summary = import_candles(
                    db,
                    spec,
                    archive.path,
                    preset="histdata",
                    label=LABEL,
                    price_side=PRICE_SIDE,
                    coverage=(None if index == 0 else start, None if index == last else end),
                )
            except (CandleImportError, OSError, ValueError) as exc:
                db.rollback()
                result.failures.append(f"{archive.path.name}: {getattr(exc, 'message', exc)}")
                continue
            if summary.duplicate:
                result.duplicates += 1
            elif summary.rows_kept:
                result.imported += 1
                result.rows += summary.rows_kept
            else:
                result.failures.append(f"{archive.path.name}: no usable rows ({summary.rejected})")
    return result


@dataclass
class EnableResult:
    symbol: str
    enabled: bool
    months: int
    gap_minutes: int
    expected_minutes: int
    failed_checks: list[str]


def verify_and_enable(spec: InstrumentSpec, *, write: bool) -> EnableResult:
    """Run the stored-data checks (gap report counted as reviewed) and enable the instrument if all pass."""
    from sqlalchemy import func, select

    from app.core.db import SessionLocal
    from app.services.marketdata.verify import verify_stored

    with SessionLocal() as db:
        checks = verify_stored(db, spec, gaps_reviewed=True, write=write)
        months, gaps, expected = db.execute(
            select(
                func.count(),
                func.coalesce(func.sum(CandleMonthStat.gap_minutes), 0),
                func.coalesce(func.sum(CandleMonthStat.detail["expected_minutes"].as_integer()), 0),
            ).where(CandleMonthStat.instrument == spec.symbol, CandleMonthStat.source == spec.source)
        ).one()
    failed = [f"{item.name}: {item.detail}" for item in checks if not item.passed]
    if failed and write and spec.enabled:
        mark_disabled(spec.symbol)
    return EnableResult(spec.symbol, not failed and write, int(months), int(gaps), int(expected), failed)


def load_all(root: Path, symbols: list[str] | None = None, *, jobs: int = 1, reset: bool = False, on_done=None):
    """Register and load every folder under `root`. Returns (results, skipped)."""
    found, skipped = find_archives(root, symbols)
    register(list(found))
    results: list[SymbolResult] = []
    if jobs <= 1 or len(found) <= 1:
        for folder, archives in found.items():
            results.append(load_symbol(folder, archives, reset))
            if on_done:
                on_done(results[-1])
        return results, skipped
    with ProcessPoolExecutor(max_workers=jobs) as pool:
        futures = [pool.submit(load_symbol, folder, archives, reset) for folder, archives in found.items()]
        for future in futures:
            results.append(future.result())
            if on_done:
                on_done(results[-1])
    return results, skipped
