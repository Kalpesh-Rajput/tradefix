"""Import 1-minute candle files into the instrument's existing store. No network fetch.

Presets match published layouts, not a guessed broker dialect:

- ``dukascopy``: JForex / Dukascopy historical export. Header ``Gmt time,Open,High,Low,Close,Volume``,
  timestamps ``dd.MM.yyyy HH:mm:ss`` with optional milliseconds, UTC. Price side defaults to bid.
- ``histdata``: HistData.com generic 1-minute ASCII. No header, ``YYYYMMDD HHMMSS;open;high;low;close;volume``.
  HistData publishes these times as GMT-5 with no daylight-saving shift, so they are converted by adding
  five hours. Confirm a real file before trusting a month (see HUMAN_QA).
- ``generic``: the caller names the separator, strptime format, IANA timezone, and column order.

The operator is responsible for having the right to use the file. See LICENSING_NOTES.
"""

from __future__ import annotations

import csv
import hashlib
import io
import logging
import zipfile
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.market_data import CandleImport, CandleMonthStat
from app.services.marketdata.candles import Candles
from app.services.marketdata.coverage import record_fetch
from app.services.marketdata.registry import InstrumentSpec
from app.services.marketdata.store import CandleStore, months_between
from app.services.marketdata.validation import gap_summary, validate_batch

logger = logging.getLogger(__name__)

PRICE_SIDES = ("bid", "mid", "other")
_HISTDATA_OFFSET = timezone(timedelta(hours=-5))


class CandleImportError(Exception):
    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


@dataclass
class ImportSummary:
    rows_read: int = 0
    rows_kept: int = 0
    rejected: dict[str, int] = field(default_factory=dict)
    range_start: int | None = None
    range_end: int | None = None
    gap_minutes: int = 0
    dry_run: bool = False
    duplicate: bool = False
    price_side: str = ""
    label: str = ""

    def as_dict(self) -> dict:
        return asdict(self)


def collect_files(path: Path) -> list[tuple[str, bytes]]:
    """A csv file, a zip of csv files, or a folder of csv files."""
    if not path.exists():
        raise CandleImportError(f"path not found: {path}")
    if path.is_dir():
        files = [(item.name, item.read_bytes()) for item in sorted(path.rglob("*.csv")) if item.is_file()]
    elif path.suffix.lower() == ".zip":
        files = []
        with zipfile.ZipFile(path) as archive:
            for info in archive.infolist():
                if info.is_dir() or not info.filename.lower().endswith(".csv"):
                    continue
                files.append((Path(info.filename).name, archive.read(info)))
    else:
        files = [(path.name, path.read_bytes())]
    if not files:
        raise CandleImportError(f"no csv files in {path}")
    return files


def content_hash(files: list[tuple[str, bytes]]) -> str:
    digest = hashlib.sha256()
    for name, data in sorted(files):
        digest.update(name.encode("utf-8"))
        digest.update(b"\0")
        digest.update(data)
    return digest.hexdigest()


def _timezone(name: str):
    if name in ("UTC", "Etc/UTC"):
        return timezone.utc
    if name == "UTC-5":
        return _HISTDATA_OFFSET
    try:
        return ZoneInfo(name)
    except Exception as exc:
        raise CandleImportError(f"unknown timezone {name}") from exc


def _parse_time(text: str, formats: tuple[str, ...], tz) -> int:
    last: Exception | None = None
    for fmt in formats:
        try:
            naive = datetime.strptime(text.strip(), fmt)
        except ValueError as exc:
            last = exc
            continue
        return int(naive.replace(tzinfo=tz).timestamp() * 1000)
    raise ValueError(str(last or text))


def _layout(preset: str, *, time_format: str, separator: str, columns: str, timezone_name: str) -> dict:
    if preset == "dukascopy":
        return {
            "formats": ("%d.%m.%Y %H:%M:%S.%f", "%d.%m.%Y %H:%M:%S"),
            "separator": ",",
            "columns": ["time", "open", "high", "low", "close", "volume"],
            "timezone": timezone_name or "UTC",
            "header": True,
        }
    if preset == "histdata":
        return {
            "formats": ("%Y%m%d %H%M%S",),
            "separator": ";",
            "columns": ["time", "open", "high", "low", "close", "volume"],
            "timezone": "UTC-5",
            "header": False,
        }
    if preset != "generic":
        raise CandleImportError(f"unknown preset {preset}")
    names = [part.strip() for part in columns.split(",") if part.strip()]
    if names[:5] != ["time", "open", "high", "low", "close"] and set(names) & {"time", "open", "high", "low", "close"} != {
        "time", "open", "high", "low", "close",
    }:
        raise CandleImportError("generic columns must include time, open, high, low, close")
    if not time_format or not timezone_name:
        raise CandleImportError("generic imports need a time format and a timezone")
    return {
        "formats": (time_format,),
        "separator": separator or ",",
        "columns": names,
        "timezone": timezone_name,
        "header": False,
    }


def parse_files(files: list[tuple[str, bytes]], layout: dict) -> tuple[list[tuple], dict[str, int]]:
    tz = _timezone(layout["timezone"])
    indexes = {name: index for index, name in enumerate(layout["columns"])}
    rows: list[tuple] = []
    rejected: dict[str, int] = {}

    def reject(reason: str) -> None:
        rejected[reason] = rejected.get(reason, 0) + 1

    for _name, data in files:
        text = data.decode("utf-8-sig")
        reader = csv.reader(io.StringIO(text), delimiter=layout["separator"])
        first = True
        for cells in reader:
            if not cells or not any(cell.strip() for cell in cells):
                continue
            if first and layout["header"] and not cells[0].strip()[:1].isdigit():
                first = False
                continue
            first = False
            if len(cells) <= max(indexes.values()):
                reject("short_row")
                continue
            try:
                ts = _parse_time(cells[indexes["time"]], layout["formats"], tz)
                o = float(cells[indexes["open"]])
                h = float(cells[indexes["high"]])
                low = float(cells[indexes["low"]])
                c = float(cells[indexes["close"]])
                volume = float(cells[indexes["volume"]]) if "volume" in indexes and cells[indexes["volume"]].strip() else 0.0
            except ValueError:
                reject("bad_row")
                continue
            rows.append((ts, o, h, low, c, volume))
    rows.sort(key=lambda row: row[0])
    return rows, rejected


def _conflicts(db: Session, spec: InstrumentSpec, months: list[tuple[int, int]], price_side: str) -> list[str]:
    found = []
    for year, month in months:
        row = db.scalar(
            select(CandleMonthStat).where(
                CandleMonthStat.instrument == spec.symbol,
                CandleMonthStat.source == spec.source,
                CandleMonthStat.year == year,
                CandleMonthStat.month == month,
            )
        )
        if row is not None and row.price_side and row.price_side != price_side:
            found.append(f"{year}-{month:02d} is {row.price_side}")
    return found


def _stamp(db: Session, spec: InstrumentSpec, months: list[tuple[int, int]], price_side: str, provenance: dict) -> None:
    for year, month in months:
        row = db.scalar(
            select(CandleMonthStat).where(
                CandleMonthStat.instrument == spec.symbol,
                CandleMonthStat.source == spec.source,
                CandleMonthStat.year == year,
                CandleMonthStat.month == month,
            )
        )
        if row is None:
            continue
        row.price_side = price_side
        row.sources = [*(row.sources or []), provenance]


def import_candles(
    db: Session,
    spec: InstrumentSpec,
    path: Path,
    *,
    preset: str,
    label: str,
    price_side: str,
    store: CandleStore | None = None,
    timezone_name: str = "",
    time_format: str = "",
    separator: str = ",",
    columns: str = "",
    dry_run: bool = False,
    force: bool = False,
) -> ImportSummary:
    if price_side not in PRICE_SIDES:
        raise CandleImportError("price side must be bid, mid, or other")
    if not label.strip():
        raise CandleImportError("a source label is required")
    files = collect_files(path)
    digest = content_hash(files)
    existing = db.scalar(
        select(CandleImport).where(CandleImport.instrument == spec.symbol, CandleImport.content_hash == digest)
    )
    if existing is not None and not dry_run:
        summary = ImportSummary(**existing.summary)
        summary.duplicate = True
        return summary
    layout = _layout(preset, time_format=time_format, separator=separator, columns=columns, timezone_name=timezone_name)
    parsed, rejected = parse_files(files, layout)
    summary = ImportSummary(rows_read=len(parsed) + sum(rejected.values()), rejected=dict(rejected), dry_run=dry_run, price_side=price_side, label=label)
    if not parsed:
        summary.rejected = rejected or {"empty": 1}
        return summary
    candles = Candles.from_rows(parsed)
    clean, report = validate_batch(candles, symbol=spec.symbol)
    summary.rejected = {**rejected, **report.rejected}
    summary.rows_kept = len(clean)
    if not len(clean):
        return summary
    start = int(clean.ts[0])
    end = int(clean.ts[-1]) + 60_000
    summary.range_start, summary.range_end = start, end
    summary.gap_minutes = gap_summary(clean.ts, spec.asset_class, start, end).missing_minutes
    months = months_between(start, end)
    clashes = _conflicts(db, spec, months, price_side)
    if clashes and not force:
        raise CandleImportError(
            "refusing to mix price sides in an existing month (" + ", ".join(clashes) + "); pass force to override"
        )
    if clashes and force:
        logger.warning("price side override symbol=%s from=%s to=%s months=%s", spec.symbol, clashes, price_side, months)
    if dry_run:
        return summary
    if store is None:
        from app.services.marketdata.store import get_store

        store = get_store()
    written = record_fetch(db, store, spec, start, end, clean)
    summary.rows_kept = written.rows_kept
    provenance = {
        "label": label,
        "filenames": [name for name, _ in files],
        "content_hashes": [digest],
    }
    _stamp(db, spec, months, price_side, provenance)
    db.add(
        CandleImport(
            instrument=spec.symbol,
            source=spec.source,
            label=label,
            price_side=price_side,
            timezone_name=layout["timezone"],
            preset=preset,
            content_hash=digest,
            filenames=[name for name, _ in files],
            summary=summary.as_dict(),
        )
    )
    db.commit()
    return summary
