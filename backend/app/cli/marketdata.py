"""Market-data operations CLI: `python -m app.cli.marketdata <command> ...` (run from backend/)."""

from __future__ import annotations

import argparse
import logging
import sys
from datetime import datetime, timezone
from typing import Callable

from app.services.marketdata.registry import get_instrument

Command = Callable[[argparse.Namespace], int]
COMMANDS: dict[str, tuple[Command, Callable[[argparse.ArgumentParser], None], str]] = {}


def command(name: str, help_text: str, configure: Callable[[argparse.ArgumentParser], None] = lambda p: None):
    def register(fn: Command) -> Command:
        COMMANDS[name] = (fn, configure, help_text)
        return fn

    return register


def _symbols(values: list[str]) -> list:
    specs = []
    for value in values:
        spec = get_instrument(value)
        if spec is None:
            raise SystemExit(f"unknown instrument {value!r} (not in instruments.yaml)")
        specs.append(spec)
    return specs


def _verify_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("symbols", nargs="+")
    parser.add_argument("--write", action="store_true", help="stamp verified_on and enable on success")
    parser.add_argument("--stored", action="store_true", help="check candles already stored instead of fetching")
    parser.add_argument("--gaps-reviewed", action="store_true", help="with --stored, accept a month that still has gaps")


@command("verify-instrument", "fetch one real recent day per symbol and sanity-check it", _verify_args)
def verify_instrument_cmd(args: argparse.Namespace) -> int:
    from app.core.db import SessionLocal
    from app.services.marketdata.verify import verify_and_record, verify_stored

    failures = 0
    if args.stored:
        with SessionLocal() as db:
            for spec in _symbols(args.symbols):
                checks = verify_stored(db, spec, gaps_reviewed=args.gaps_reviewed, write=args.write)
                ok = all(item.passed for item in checks)
                print(("OK" if ok else "FAIL") + f" {spec.symbol} stored")
                for item in checks:
                    print(f"    {'PASS' if item.passed else 'FAIL'} {item.name}: {item.detail}")
                failures += not ok
        return 1 if failures else 0
    for spec in _symbols(args.symbols):
        result = verify_and_record(spec, write=args.write)
        status = "OK" if result.ok else "FAIL"
        prices = f"{result.price_min}..{result.price_max}" if result.price_min is not None else "n/a"
        print(f"{status} {spec.symbol} {result.day} rows={result.rows}/{result.expected_open_minutes} prices={prices}"
              + (" written" if result.written else ""))
        for problem in result.problems:
            print(f"    - {problem}")
        failures += not result.ok
    return 1 if failures else 0


def _import_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("symbol")
    parser.add_argument("path", help="a csv file, a zip of csv files, or a folder of csv files")
    parser.add_argument("--preset", choices=["dukascopy", "histdata", "generic"], required=True)
    parser.add_argument("--label", required=True, help="where the file came from, stored with the month")
    parser.add_argument("--price-side", choices=["bid", "mid", "other"], default="bid")
    parser.add_argument("--timezone", default="", help="IANA name; presets have their own default")
    parser.add_argument("--time-format", default="", help="strptime format for the generic preset")
    parser.add_argument("--separator", default=",")
    parser.add_argument("--columns", default="", help="generic column order, e.g. time,open,high,low,close,volume")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--force", action="store_true", help="overwrite a month that was stored with a different price side")


@command("import-candles", "import a 1-minute candle file into the instrument store", _import_args)
def import_candles_cmd(args: argparse.Namespace) -> int:
    from pathlib import Path

    from app.core.db import SessionLocal
    from app.services.marketdata.importer import CandleImportError, import_candles
    from app.services.marketdata.registry import mirror_to_db

    spec = _symbols([args.symbol])[0]
    with SessionLocal() as db:
        mirror_to_db(db)
        try:
            summary = import_candles(
                db, spec, Path(args.path),
                preset=args.preset, label=args.label, price_side=args.price_side,
                timezone_name=args.timezone, time_format=args.time_format,
                separator=args.separator, columns=args.columns,
                dry_run=args.dry_run, force=args.force,
            )
        except CandleImportError as exc:
            print(exc.message)
            return 1
    print(
        f"rows_read={summary.rows_read} rows_kept={summary.rows_kept} rejected={summary.rejected} "
        f"range={summary.range_start}..{summary.range_end} gap_minutes={summary.gap_minutes} "
        f"dry_run={summary.dry_run} duplicate={summary.duplicate}"
    )
    return 0 if summary.rows_kept or summary.duplicate else 1


def _admin_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("email")
    parser.add_argument("--revoke", action="store_true", help="set the role back to trader")


@command("make-admin", "grant (or --revoke) the admin role for market-data operations", _admin_args)
def make_admin_cmd(args: argparse.Namespace) -> int:
    from app.core.db import SessionLocal
    from app.services.user_roles import set_admin

    with SessionLocal() as db:
        try:
            user, changed = set_admin(db, args.email, revoke=args.revoke)
        except LookupError as exc:
            print(str(exc))
            return 1
    print(f"{user.email}: role={user.role}" + ("" if changed else " (unchanged)"))
    return 0


def _day(value: str) -> int:
    try:
        moment = datetime.strptime(value, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"{value!r} is not a YYYY-MM-DD date") from exc
    return int(moment.timestamp() * 1000)


def _iso(ms: int) -> str:
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d %H:%M")


def _targets(symbols: list[str], all_enabled: bool) -> list:
    from app.services.marketdata.registry import enabled_instruments

    if all_enabled:
        return enabled_instruments()
    if not symbols:
        raise SystemExit("name at least one symbol, or pass --all")
    return _symbols(symbols)


def _print_backfill(result) -> None:
    if result.error:
        print(f"FAIL {result.symbol}: {result.error} (stored rows so far: {result.rows})")
    elif result.job_id:
        print(f"QUEUED {result.symbol}: {result.missing_minutes} minutes missing, job {result.job_id}")
    elif not result.gaps:
        print(f"OK {result.symbol}: already covered {_iso(result.requested[0])} .. {_iso(result.requested[1])}")
    else:
        print(f"OK {result.symbol}: {result.rows} rows in {result.chunks} chunk(s)")


def _backfill_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("symbols", nargs="*")
    parser.add_argument("--all", action="store_true", help="every enabled instrument")
    parser.add_argument("--from", dest="start", type=_day, help="UTC day, inclusive (default: preload years back)")
    parser.add_argument("--to", dest="end", type=_day, help="UTC day, exclusive (default: last closed day)")
    parser.add_argument("--enqueue", action="store_true", help="hand the gaps to the market worker instead")


@command("backfill", "fetch missing candles for a range or the configured preload years", _backfill_args)
def backfill_cmd(args: argparse.Namespace) -> int:
    from app.core.db import SessionLocal
    from app.services.marketdata import operations

    failures = 0
    with SessionLocal() as db:
        for spec in _targets(args.symbols, args.all):
            default_start, default_end = operations.preload_range(spec)
            start, end = args.start or default_start, args.end or default_end
            if end <= start:
                raise SystemExit("--to must be after --from")

            def progress(percent: int, chunks: int, via: str, symbol=spec.symbol) -> None:
                print(f"  {symbol} {percent}% ({chunks} chunks, {via})", flush=True)

            result = operations.backfill(db, spec, start, end, enqueue=args.enqueue, progress=progress)
            _print_backfill(result)
            failures += bool(result.error)
    return 1 if failures else 0


@command("top-up", "fetch from each enabled instrument's last covered minute to the last closed day")
def top_up_cmd(args: argparse.Namespace) -> int:
    from app.core.db import SessionLocal
    from app.services.marketdata.operations import top_up

    with SessionLocal() as db:
        summary = top_up(db)
    for row in summary:
        detail = row.get("error") or row.get("reason") or (f"{row['rows']} rows" if "rows" in row else "")
        print(f"{row['status'].upper():<10} {row['symbol']} {detail}")
    return 1 if any(row["status"] == "failed" for row in summary) else 0


@command("seed-demo", "load the previous full month for BTCUSDT, EURUSD and XAUUSD")
def seed_demo_cmd(args: argparse.Namespace) -> int:
    from app.core.db import SessionLocal
    from app.services.marketdata.operations import seed_demo

    with SessionLocal() as db:
        results = seed_demo(db)
    for result in results:
        _print_backfill(result)
    return 1 if any(r.error for r in results) else 0


def _coverage_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("symbols", nargs="*")
    parser.add_argument("--reset", action="store_true", help="forget coverage so the next backfill refetches")


@command("coverage", "print covered ranges, holes and per-month gap statistics", _coverage_args)
def coverage_cmd(args: argparse.Namespace) -> int:
    from app.core.db import SessionLocal
    from app.services.marketdata.coverage import reset_coverage
    from app.services.marketdata.operations import coverage_report
    from app.services.marketdata.registry import all_instruments

    with SessionLocal() as db:
        specs = _symbols(args.symbols) if args.symbols else list(all_instruments())
        if args.reset:
            removed = sum(reset_coverage(db, spec.symbol) for spec in specs)
            db.commit()
            print(f"removed {removed} coverage row(s)")
            return 0
        for spec in specs:
            report = coverage_report(db, spec)
            if not report.ranges:
                continue
            print(f"{report.symbol} ({report.source})")
            for r in report.ranges:
                print(f"  covered {_iso(r['from'])} .. {_iso(r['to'])}")
            for a, b in report.holes:
                print(f"  HOLE    {_iso(a)} .. {_iso(b)}")
            for m in report.months:
                print(f"  {m['month']} rows={m['rows']} expected={m['expected_minutes']} "
                      f"gap_minutes={m['gap_minutes']} outliers={m['outliers']}")
    return 0


def _verify_store_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("symbols", nargs="*")


@command("verify", "re-validate stored month files and report problems", _verify_store_args)
def verify_cmd(args: argparse.Namespace) -> int:
    from app.core.db import SessionLocal
    from app.services.marketdata.operations import verify_stored
    from app.services.marketdata.registry import all_instruments

    problems = 0
    with SessionLocal() as db:
        for spec in _symbols(args.symbols) if args.symbols else list(all_instruments()):
            for check in verify_stored(db, spec):
                status = "FAIL" if check.problems else "OK"
                print(f"{status} {spec.symbol} {check.month} rows={check.rows} gap_minutes={check.gap_minutes}")
                for problem in check.problems:
                    print(f"    - {problem}")
                problems += bool(check.problems)
    return 1 if problems else 0


def _alias_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("broker", help="broker key, or * for every broker")
    parser.add_argument("raw_symbol")
    parser.add_argument("canonical")


@command("add-alias", "map a broker symbol to a canonical instrument", _alias_args)
def add_alias_cmd(args: argparse.Namespace) -> int:
    from app.core.db import SessionLocal
    from app.services.marketdata.resolver import add_alias

    with SessionLocal() as db:
        try:
            row = add_alias(db, args.broker, args.raw_symbol, args.canonical, created_by="cli")
        except ValueError as exc:
            print(str(exc))
            return 1
        db.commit()
        print(f"{row.broker}:{row.raw_symbol} -> {row.canonical_symbol}")
    return 0


def _unresolved_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--limit", type=int, default=50)


@command("unresolved", "list the most common broker symbols that did not resolve", _unresolved_args)
def unresolved_cmd(args: argparse.Namespace) -> int:
    from app.core.db import SessionLocal
    from app.services.marketdata.resolver import unresolved_report

    with SessionLocal() as db:
        rows = unresolved_report(db, limit=args.limit)
    if not rows:
        print("no unresolved symbols")
    for row in rows:
        print(f"{row.count:>6}  interest={row.interest_count:<4} {row.broker}:{row.raw_symbol}")
    return 0


def _detect_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--user", help="user email")
    parser.add_argument("--account", help="journal account id")
    parser.add_argument("--force-naive", action="store_true", help="test every trade, even ones marked utc_aware")


@command("detect-offsets", "detect each account's trade-time basis from stored candles", _detect_args)
def detect_offsets_cmd(args: argparse.Namespace) -> int:
    import uuid

    from sqlalchemy import func, select

    from app.core.db import SessionLocal
    from app.models.user import User
    from app.services.marketdata.time_offsets import detect_offsets

    with SessionLocal() as db:
        user_id = None
        if args.user:
            user_id = db.scalar(select(User.id).where(func.lower(User.email) == args.user.strip().lower()))
            if user_id is None:
                print(f"no user with email {args.user}")
                return 1
        try:
            account_id = uuid.UUID(args.account) if args.account else None
        except ValueError:
            print(f"{args.account!r} is not an account id")
            return 1
        results = detect_offsets(db, user_id=user_id, account_id=account_id, force_naive=args.force_naive)
        if not results:
            print("no matching accounts")
        for account, row in results:
            if row is None:
                print(f"SKIP    {account.name} ({account.id}): no naive trades with stored candles")
            else:
                print(f"{row.confidence.upper():<7} {account.name} ({account.id}): {row.tz_value} "
                      f"rate={row.match_rate:.2f} n={row.sample_size} runner_up={row.runner_up} ({row.runner_up_rate})")
    return 0


@command("offsets-report", "list detected time offsets per account")
def offsets_report_cmd(args: argparse.Namespace) -> int:
    from app.core.db import SessionLocal
    from app.services.marketdata.time_offsets import offsets_report

    with SessionLocal() as db:
        rows = offsets_report(db)
    if not rows:
        print("no offsets detected yet; run detect-offsets")
    for row in rows:
        print(f"{row['confidence']:<7} {row['user_email']} / {row['account_name']}: {row['tz_value']} "
              f"rate={row['match_rate']:.2f} n={row['sample_size']} runner_up={row['runner_up']} {row['computed_at']:%Y-%m-%d}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m app.cli.marketdata")
    sub = parser.add_subparsers(dest="command", required=True)
    for name, (fn, configure, help_text) in COMMANDS.items():
        child = sub.add_parser(name, help=help_text)
        configure(child)
        child.set_defaults(handler=fn)
    return parser


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    args = build_parser().parse_args(argv)
    return int(args.handler(args) or 0)


if __name__ == "__main__":
    sys.exit(main())
