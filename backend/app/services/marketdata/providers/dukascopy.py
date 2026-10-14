"""Dukascopy 1m candles via the pinned dukascopy-node CLI (backtesting/02 section 7, D-009).

1m, UTC (offset 0), BID by default, flats excluded so market-closed minutes stay absent, fetched in
`DUKASCOPY_CHUNK_DAYS` chunks. Personal-use licensing: the adapter is behind `DUKASCOPY_ENABLED`.
"""

from __future__ import annotations

import json
import logging
import shutil
import subprocess
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Iterator

from app.core.config import backend_path, settings
from app.services.marketdata.candles import MINUTE_MS, Candles
from app.services.marketdata.providers.base import Chunk, ProviderError, Throttle, no_throttle
from app.services.marketdata.registry import InstrumentSpec
from app.services.marketdata.validation import closed_windows, validate_batch

logger = logging.getLogger(__name__)

DAY_MS = 86_400_000
CLI_RELATIVE = Path("node_modules/dukascopy-node/dist/cli/index.js")
MAX_REJECTED_RATIO = 0.01
_FIELDS = ("timestamp", "open", "high", "low", "close", "volume")

Runner = Callable[..., subprocess.CompletedProcess]


def parse_tool_output(text: str) -> Candles:
    """Parse dukascopy-node `json` (objects) or `array` output. An empty file means no candles."""
    if not text.strip():
        return Candles.empty()
    try:
        items = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ProviderError("malformed_output", f"dukascopy output is not valid JSON: {exc.msg}") from exc
    if not isinstance(items, list):
        raise ProviderError("malformed_output", "dukascopy output is not a list")
    rows: list[tuple] = []
    for index, item in enumerate(items):
        try:
            values = [item.get(f, 0.0 if f == "volume" else None) for f in _FIELDS] if isinstance(item, dict) else list(item)
            if len(values) < 5 or any(v is None for v in values[:5]):
                raise ValueError("missing field")
            rows.append((int(values[0]), *(float(v) for v in values[1:6])))
        except (TypeError, ValueError) as exc:
            raise ProviderError("malformed_output", f"dukascopy row {index} is malformed: {exc}") from exc
    return Candles.from_rows(rows)


def chunk_windows(start_ms: int, end_ms: int, chunk_days: int) -> list[tuple[int, int]]:
    """Day-aligned windows covering [start, end); the CLI works in whole UTC dates."""
    windows = []
    cursor = start_ms - start_ms % DAY_MS
    step = max(1, chunk_days) * DAY_MS
    while cursor < end_ms:
        windows.append((cursor, min(cursor + step, end_ms + (-end_ms) % DAY_MS)))
        cursor += step
    return windows


def _date(ms: int) -> str:
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d")


class DukascopyProvider:
    name = "dukascopy"

    def __init__(
        self,
        *,
        throttle: Throttle | None = None,
        runner: Runner = subprocess.run,
        tool_dir: Path | None = None,
        chunk_days: int | None = None,
        now_ms: Callable[[], int] | None = None,
        node: str | None = None,
    ) -> None:
        self.throttle = throttle or no_throttle
        self.runner = runner
        self.tool_dir = tool_dir or backend_path(settings.dukascopy_tool_dir)
        self.chunk_days = chunk_days or settings.dukascopy_chunk_days
        self.now_ms = now_ms or (lambda: int(time.time() * 1000))
        self.node = node

    def _command(self, spec: InstrumentSpec, day_from: int, day_to: int, out_dir: str) -> list[str]:
        node = self.node or shutil.which("node")
        if not node:
            raise ProviderError("node_missing", "Node.js is required for the Dukascopy downloader", retryable=False)
        cli = self.tool_dir / CLI_RELATIVE
        if not cli.exists():
            raise ProviderError("tool_missing", f"run `npm ci` in {self.tool_dir}", retryable=False)
        return [
            node, str(cli),
            "-i", spec.provider_id,
            "-from", _date(day_from),
            "-to", _date(day_to),
            "-t", "m1",
            "-p", settings.dukascopy_price_side,
            "-utc", "0",
            "-v",
            "-f", "json",
            "-dir", out_dir,
            "-fn", "candles",
            "-r", "3",
            "-rp", "2000",
            "-bs", "4",
            "-bp", "1500",
            "-s",
        ]

    def fetch_window(self, spec: InstrumentSpec, day_from: int, day_to: int) -> Candles:
        with tempfile.TemporaryDirectory(prefix="dukascopy-") as out_dir:
            command = self._command(spec, day_from, day_to, out_dir)
            self.throttle()
            try:
                result = self.runner(command, capture_output=True, text=True, timeout=settings.dukascopy_timeout_s)
            except subprocess.TimeoutExpired as exc:
                raise ProviderError("provider_timeout", f"dukascopy download exceeded {settings.dukascopy_timeout_s}s") from exc
            if result.returncode != 0:
                tail = (result.stderr or result.stdout or "").strip()[-300:]
                raise ProviderError("provider_failed", f"dukascopy-node exited {result.returncode}: {tail}")
            output = Path(out_dir) / "candles.json"
            text = output.read_text(encoding="utf-8") if output.exists() else ""
        candles = parse_tool_output(text)
        clean, report = validate_batch(candles, symbol=spec.symbol)
        if report.received and report.rejected_total / report.received > MAX_REJECTED_RATIO:
            raise ProviderError("invalid_output", f"dukascopy rejected {report.rejected_total} of {report.received} rows: {report.rejected}")
        return clean

    def iter_chunks(self, spec: InstrumentSpec, start_ms: int, end_ms: int) -> Iterator[Chunk]:
        if not settings.dukascopy_enabled:
            raise ProviderError("provider_disabled", "Dukascopy ingestion is disabled (DUKASCOPY_ENABLED)", retryable=False)
        end = min(end_ms, self.now_ms() - self.now_ms() % MINUTE_MS)
        start = start_ms - start_ms % MINUTE_MS
        for day_from, day_to in chunk_windows(start, end, self.chunk_days):
            a, b = max(start, day_from), min(end, day_to)
            if b <= a:
                continue
            candles = self.fetch_window(spec, day_from, day_to).between(a, b)
            if not len(candles) and _has_open_minutes(spec.asset_class, a, b):
                raise ProviderError(
                    "provider_empty",
                    f"dukascopy returned no candles for {_date(a)}..{_date(b - 1)} although the market was open",
                )
            yield Chunk(a, b, candles, "dukascopy")


def _has_open_minutes(asset_class: str, start_ms: int, end_ms: int) -> bool:
    closed = sum(b - a for a, b in closed_windows(asset_class, start_ms, end_ms))
    return (end_ms - start_ms) - closed >= 60 * MINUTE_MS


def tool_status(tool_dir: Path | None = None) -> dict:
    """For health/admin views: is the Dukascopy tool runnable here?"""
    directory = tool_dir or backend_path(settings.dukascopy_tool_dir)
    return {
        "enabled": settings.dukascopy_enabled,
        "node": shutil.which("node") is not None,
        "tool_installed": (directory / CLI_RELATIVE).exists(),
    }
