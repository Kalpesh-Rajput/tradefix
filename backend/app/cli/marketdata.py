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


@command("verify-instrument", "fetch one real recent day per symbol and sanity-check it", _verify_args)
def verify_instrument_cmd(args: argparse.Namespace) -> int:
    from app.services.marketdata.verify import verify_and_record

    failures = 0
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
