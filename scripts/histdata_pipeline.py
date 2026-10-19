#!/usr/bin/env python3
"""Turn local HistData zips into 1-minute candles and optionally store them.

This script does not contact histdata.com. Drop zip files you downloaded
yourself into the repository ``downloads`` folder (gitignored).

Accepted files:

- Generic ASCII 1-minute bars: ``YYYYMMDD HHMMSS;open;high;low;close;volume``
- Generic ASCII ticks: ``YYYYMMDD HHMMSSmmm,bid,ask,volume``

Ticks are folded into 1-minute bid bars (first, high, low, last bid). The
written csv keeps HistData's EST-no-DST clock so ``import-candles --preset
histdata`` can add five hours once.

    py scripts/histdata_pipeline.py --store
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import io
import json
import logging
import re
import subprocess
import sys
import zipfile
from pathlib import Path, PurePosixPath


REPO = Path(__file__).resolve().parents[1]
EST = dt.timezone(dt.timedelta(hours=-5), name="EST-no-DST")
UTC = dt.timezone.utc
SYMBOL_RE = re.compile(r"(?:^|[_\-])([A-Z]{6})(?:[_\-.]|M1|T\d|$)")
M1_TIME = re.compile(r"^\d{8} \d{6}$")
TICK_TIME = re.compile(r"^\d{8} \d{9}$")


class Bar:
    def __init__(self, open_s: str, high_s: str, low_s: str, close_s: str, volume: float, first_key: str, last_key: str):
        self.open_s = open_s
        self.high = float(high_s)
        self.high_s = high_s
        self.low = float(low_s)
        self.low_s = low_s
        self.close_s = close_s
        self.volume = volume
        self.first_key = first_key
        self.last_key = last_key

    def add_tick(self, key: str, bid_s: str, volume: float) -> None:
        bid = float(bid_s)
        if key < self.first_key:
            self.first_key = key
            self.open_s = bid_s
        if key >= self.last_key:
            self.last_key = key
            self.close_s = bid_s
        if bid > self.high:
            self.high = bid
            self.high_s = bid_s
        if bid < self.low:
            self.low = bid
            self.low_s = bid_s
        self.volume += volume

    def line(self, stamp: str) -> str:
        volume = str(int(self.volume)) if self.volume == int(self.volume) else f"{self.volume:.10g}"
        return ";".join([stamp, self.open_s, self.high_s, self.low_s, self.close_s, volume])


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare local HistData zips and store 1-minute candles.")
    parser.add_argument("--input-dir", default=str(REPO / "downloads"), help="Folder of HistData zip files.")
    parser.add_argument("--output-dir", default=str(REPO / "downloads"), help="Folder for tradefix/*.csv and reports/.")
    parser.add_argument("--symbol", default="", help="Symbol to use when the zip name has none, e.g. EURUSD.")
    parser.add_argument("--years", type=int, default=0, help="Keep this many years ending at --end-date. 0 keeps every bar.")
    parser.add_argument("--start-date", help="Inclusive UTC date YYYY-MM-DD. Overrides --years.")
    parser.add_argument("--end-date", help="Inclusive UTC date YYYY-MM-DD. Defaults to today.")
    parser.add_argument("--store", action="store_true", help="Import the written csv files into the candle store.")
    parser.add_argument("--max-archive-mb", type=int, default=2048)
    parser.add_argument("--max-member-mb", type=int, default=4096)
    return parser.parse_args()


def setup_logging() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s", handlers=[logging.StreamHandler(sys.stdout)])


def parse_date(value: str | None, default: dt.date) -> dt.date:
    if not value:
        return default
    try:
        return dt.date.fromisoformat(value)
    except ValueError as exc:
        raise SystemExit(f"Invalid date {value!r}; expected YYYY-MM-DD") from exc


def symbol_from_name(name: str, fallback: str) -> str:
    match = SYMBOL_RE.search(Path(name).stem.upper())
    if match:
        return match.group(1)
    return fallback.upper()


def to_utc(stamp: str) -> dt.datetime:
    naive = dt.datetime.strptime(stamp, "%Y%m%d %H%M%S")
    return naive.replace(tzinfo=EST).astimezone(UTC)


def split_row(line: str) -> list[str]:
    if ";" in line:
        return next(csv.reader([line], delimiter=";"))
    return next(csv.reader([line], delimiter=","))


def window(args: argparse.Namespace) -> tuple[dt.datetime, dt.datetime]:
    today = dt.datetime.now(UTC).date()
    end_date = parse_date(args.end_date, today)
    if args.start_date:
        start_date = parse_date(args.start_date, end_date)
    elif args.years:
        if args.years < 1:
            raise SystemExit("--years must be >= 1, or 0 to keep every row")
        try:
            start_date = end_date.replace(year=end_date.year - args.years)
        except ValueError:
            start_date = end_date.replace(year=end_date.year - args.years, day=28)
    else:
        start_date = dt.date.min
    if start_date > end_date:
        raise SystemExit("start date must be on or before end date")
    start = dt.datetime.combine(start_date, dt.time.min, tzinfo=UTC)
    end = dt.datetime.combine(end_date + dt.timedelta(days=1), dt.time.min, tzinfo=UTC)
    return start, end


def consume_zip(zip_path: Path, max_member_mb: int, bars: dict[str, Bar]) -> dict:
    stats = {"ticks": 0, "m1": 0, "malformed": 0, "non_positive": 0, "skipped_members": 0}
    with zipfile.ZipFile(zip_path) as archive:
        bad = archive.testzip()
        if bad:
            raise ValueError(f"corrupt zip member: {bad}")
        for info in archive.infolist():
            if info.is_dir():
                continue
            member = PurePosixPath(info.filename)
            if member.is_absolute() or ".." in member.parts:
                logging.warning("skipping unsafe member %s", info.filename)
                stats["skipped_members"] += 1
                continue
            if info.file_size > max_member_mb * 1024 * 1024:
                logging.warning("skipping oversized member %s", info.filename)
                stats["skipped_members"] += 1
                continue
            if Path(info.filename).suffix.lower() not in {".csv", ".txt", ""}:
                stats["skipped_members"] += 1
                continue
            with archive.open(info) as raw:
                for line in io.TextIOWrapper(raw, encoding="utf-8-sig", errors="replace"):
                    _take_line(line, bars, stats)
    return stats


def _take_line(line: str, bars: dict[str, Bar], stats: dict) -> None:
    text = line.strip().lstrip("\ufeff")
    if not text or not text[0].isdigit():
        return
    cells = [cell.strip() for cell in split_row(text)]
    if not cells:
        return
    stamp = cells[0]
    if TICK_TIME.match(stamp):
        _take_tick(stamp, cells, bars, stats)
        return
    if M1_TIME.match(stamp):
        _take_m1(stamp, cells, bars, stats)
        return
    stats["malformed"] += 1


def _take_tick(stamp: str, cells: list[str], bars: dict[str, Bar], stats: dict) -> None:
    if len(cells) < 3:
        stats["malformed"] += 1
        return
    try:
        bid = float(cells[1])
        volume = float(cells[3]) if len(cells) > 3 and cells[3] else 0.0
    except ValueError:
        stats["malformed"] += 1
        return
    if bid <= 0:
        stats["non_positive"] += 1
        return
    minute = stamp[:13] + "00"
    bar = bars.get(minute)
    if bar is None:
        bars[minute] = Bar(cells[1], cells[1], cells[1], cells[1], volume, stamp, stamp)
    else:
        bar.add_tick(stamp, cells[1], volume)
    stats["ticks"] += 1


def _take_m1(stamp: str, cells: list[str], bars: dict[str, Bar], stats: dict) -> None:
    if len(cells) < 5:
        stats["malformed"] += 1
        return
    try:
        prices = [float(cells[i]) for i in range(1, 5)]
        volume = float(cells[5]) if len(cells) > 5 and cells[5] else 0.0
    except ValueError:
        stats["malformed"] += 1
        return
    open_, high, low, close = prices
    if min(prices) <= 0 or high < max(open_, close, low) or low > min(open_, close, high):
        stats["non_positive"] += 1
        return
    volume_s = cells[5] if len(cells) > 5 and cells[5] else "0"
    bars[stamp] = Bar(cells[1], cells[2], cells[3], cells[4], float(volume_s), stamp, stamp)
    stats["m1"] += 1
    del volume


def store_file(csv_path: Path, symbol: str, label: str) -> None:
    backend = REPO / "backend"
    python = backend / "venv" / "Scripts" / "python.exe"
    if not python.exists():
        python = Path(sys.executable)
    command = [
        str(python), "-m", "app.cli.marketdata", "import-candles", symbol, str(csv_path),
        "--preset", "histdata", "--label", label, "--price-side", "bid",
    ]
    logging.info("storing %s", symbol)
    result = subprocess.run(command, cwd=backend)
    if result.returncode != 0:
        raise SystemExit(f"import failed for {symbol}")


def main() -> None:
    args = parse_args()
    setup_logging()
    fallback = args.symbol.strip().upper()
    input_dir = Path(args.input_dir).resolve()
    output_dir = Path(args.output_dir).resolve()
    ready_dir = output_dir / "tradefix"
    reports_dir = output_dir / "reports"
    input_dir.mkdir(parents=True, exist_ok=True)
    ready_dir.mkdir(parents=True, exist_ok=True)
    reports_dir.mkdir(parents=True, exist_ok=True)
    start, end = window(args)

    by_symbol: dict[str, dict[str, Bar]] = {}
    kinds: dict[str, set[str]] = {}
    reports: list[dict] = []
    zip_files = sorted(path for path in input_dir.glob("*.zip") if path.is_file())
    if not zip_files:
        raise SystemExit(f"no zip files in {input_dir}")

    for zip_path in zip_files:
        if zip_path.stat().st_size > args.max_archive_mb * 1024 * 1024:
            logging.error("archive too large, skipped: %s", zip_path.name)
            reports.append({"archive": zip_path.name, "status": "too-large"})
            continue
        if not zipfile.is_zipfile(zip_path):
            logging.error("not a zip, skipped: %s", zip_path.name)
            reports.append({"archive": zip_path.name, "status": "invalid-zip"})
            continue
        symbol = symbol_from_name(zip_path.name, fallback)
        if not symbol:
            logging.error("no symbol in %s; pass --symbol EURUSD", zip_path.name)
            reports.append({"archive": zip_path.name, "status": "no-symbol"})
            continue
        bars = by_symbol.setdefault(symbol, {})
        try:
            stats = consume_zip(zip_path, args.max_member_mb, bars)
        except (zipfile.BadZipFile, ValueError) as exc:
            logging.error("%s: %s", zip_path.name, exc)
            reports.append({"archive": zip_path.name, "status": "invalid-zip", "error": str(exc)})
            continue
        kind = "tick" if stats["ticks"] else "m1" if stats["m1"] else "empty"
        kinds.setdefault(symbol, set()).add(kind)
        reports.append({"archive": zip_path.name, "symbol": symbol, "status": "read", "kind": kind, **stats})
        logging.info("%s -> %s %s ticks=%d m1=%d", zip_path.name, symbol, kind, stats["ticks"], stats["m1"])

    written = []
    for symbol, bars in sorted(by_symbol.items()):
        kept = {stamp: bar for stamp, bar in bars.items() if start <= to_utc(stamp) < end}
        ordered = sorted(kept.items())
        target = ready_dir / f"{symbol}.csv"
        with target.open("w", encoding="utf-8", newline="\n") as handle:
            for stamp, bar in ordered:
                handle.write(bar.line(stamp) + "\n")
        first = ordered[0][0] if ordered else None
        last = ordered[-1][0] if ordered else None
        label = "histdata tick aggregated to 1-minute bid" if "tick" in kinds.get(symbol, ()) else "histdata M1"
        item = {"symbol": symbol, "path": str(target), "rows": len(ordered), "first": first, "last": last, "label": label}
        written.append(item)
        logging.info("wrote %s (%d bars, %s .. %s)", target, len(ordered), first, last)
        if args.store and ordered:
            store_file(target, symbol, label)

    summary = {
        "input_dir": str(input_dir),
        "output_dir": str(ready_dir),
        "layout": "YYYYMMDD HHMMSS;open;high;low;close;volume",
        "timezone_in_file": "EST-no-DST (UTC-5). import-candles --preset histdata converts to UTC.",
        "price_side": "bid",
        "archives": reports,
        "files": written,
    }
    report_path = reports_dir / "tradefix_import.json"
    report_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    logging.info("report: %s", report_path)
    if not any(item["rows"] for item in written):
        raise SystemExit("no 1-minute bars written")


if __name__ == "__main__":
    main()
