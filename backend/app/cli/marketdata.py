"""Market-data operations CLI: `python -m app.cli.marketdata <command> ...` (run from backend/)."""

from __future__ import annotations

import argparse
import logging
import sys
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
