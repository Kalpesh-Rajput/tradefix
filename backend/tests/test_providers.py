"""Provider adapters on recorded fixtures (backtesting 1E). Live smoke tests: `pytest -m live tests/test_providers.py`."""

from __future__ import annotations

import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import httpx
import numpy as np
import pytest

from app.services.marketdata.providers import ProviderError, get_provider
from app.services.marketdata.providers.binance import (
    BinanceProvider,
    Segment,
    normalize_timestamps,
    parse_archive,
    plan_segments,
    verify_checksum,
)
from app.services.marketdata.providers.dukascopy import DukascopyProvider, chunk_windows, parse_tool_output
from app.services.marketdata.registry import get_instrument
from app.services.marketdata.validation import validate_batch
from app.services.marketdata.verify import verification_day, verify_instrument

FIXTURES = Path(__file__).parent / "fixtures" / "marketdata"
MIN = 60_000
DAY = 86_400_000
D_2025_03_04 = 1741046400000
NOW = D_2025_03_04 + 40 * DAY
BTC = get_instrument("BTCUSDT")
BTC_PERP = get_instrument("BTCUSDT_PERP")
EURUSD = get_instrument("EURUSD")


def _ms(*args) -> int:
    return int(datetime(*args, tzinfo=timezone.utc).timestamp() * 1000)


def _fixture(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


def _provider(handler, **kw) -> tuple[BinanceProvider, list[float]]:
    waits: list[float] = []
    provider = BinanceProvider(
        client=httpx.Client(transport=httpx.MockTransport(handler)),
        sleep=waits.append,
        now_ms=kw.pop("now_ms", lambda: NOW),
        rest_hosts=kw.pop("rest_hosts", ["https://api.binance.com", "https://data-api.binance.vision"]),
        futures_host="https://fapi.binance.com",
        archive_host="https://data.binance.vision",
    )
    return provider, waits


def _klines(start: int, n: int) -> list[list]:
    return [[start + i * MIN, "100.0", "101.0", "99.0", "100.5", "3.0", start + i * MIN + MIN - 1, "0", 1, "0", "0", "0"] for i in range(n)]


# --- Binance archives -----------------------------------------------------------------------------

def test_millisecond_and_microsecond_archives_normalize_to_ms():
    ms = parse_archive(_fixture("BTCUSDT-1m-2024-12-30.zip"))
    us = parse_archive(_fixture("BTCUSDT-1m-2025-03-04.zip"))
    assert ms.ts[0] == 1735516800000 and len(ms) == 30
    assert us.ts[0] == D_2025_03_04 and len(us) == 30
    assert np.all(np.diff(us.ts) == MIN)
    assert normalize_timestamps(np.array([1741046400000000, 1741046400000])).tolist() == [D_2025_03_04, D_2025_03_04]
    _, report = validate_batch(us)
    assert report.rejected == {}


def test_futures_archive_header_row_is_skipped():
    fut = parse_archive(_fixture("futures-BTCUSDT-1m-2025-03-04.zip"))
    assert len(fut) == 30 and fut.ts[0] == D_2025_03_04


def test_checksum_verification():
    good = _fixture("BTCUSDT-1m-2025-03-04.zip")
    checksum = _fixture("BTCUSDT-1m-2025-03-04.zip.CHECKSUM").decode()
    assert verify_checksum(good, checksum)
    assert not verify_checksum(_fixture("BTCUSDT-1m-2025-03-04.corrupt.zip"), checksum)
    assert not verify_checksum(good, "")


def test_corrupt_archive_is_retried_then_rejected():
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.path)
        if request.url.path.endswith(".CHECKSUM"):
            return httpx.Response(200, content=_fixture("BTCUSDT-1m-2025-03-04.zip.CHECKSUM"))
        return httpx.Response(200, content=_fixture("BTCUSDT-1m-2025-03-04.corrupt.zip"))

    provider, _ = _provider(handler)
    with pytest.raises(ProviderError) as exc:
        provider.fetch_archive(BTC, Segment("daily", D_2025_03_04, D_2025_03_04 + DAY))
    assert exc.value.code == "checksum_mismatch" and exc.value.retryable
    assert sum(not p.endswith(".CHECKSUM") for p in calls) == 2


def test_archive_urls_for_spot_futures_daily_monthly():
    provider, _ = _provider(lambda r: httpx.Response(404))
    assert provider.archive_url(BTC, Segment("daily", D_2025_03_04, D_2025_03_04 + DAY)) == (
        "https://data.binance.vision/data/spot/daily/klines/BTCUSDT/1m/BTCUSDT-1m-2025-03-04.zip"
    )
    assert provider.archive_url(BTC_PERP, Segment("monthly", _ms(2025, 2, 1), _ms(2025, 3, 1))) == (
        "https://data.binance.vision/data/futures/um/monthly/klines/BTCUSDT/1m/BTCUSDT-1m-2025-02.zip"
    )


def test_plan_uses_monthly_daily_then_rest():
    now = _ms(2025, 3, 4, 12, 30, 20)
    plan = plan_segments(_ms(2025, 1, 15, 6), now + DAY, now)
    kinds = [(s.kind, s.start_ms, s.end_ms) for s in plan]
    assert kinds[0] == ("rest", _ms(2025, 1, 15, 6), _ms(2025, 1, 16))
    assert ("daily", _ms(2025, 1, 31), _ms(2025, 2, 1)) in kinds
    assert ("monthly", _ms(2025, 2, 1), _ms(2025, 3, 1)) in kinds
    assert ("daily", _ms(2025, 3, 3), _ms(2025, 3, 4)) in kinds
    assert kinds[-1] == ("rest", _ms(2025, 3, 4), _ms(2025, 3, 4, 12, 30))


def test_archive_404_falls_back_to_rest():
    def handler(request: httpx.Request) -> httpx.Response:
        if "data.binance.vision" in str(request.url):
            return httpx.Response(404)
        start = int(request.url.params["startTime"])
        return httpx.Response(200, json=_klines(start, 1000) if start < D_2025_03_04 + 1000 * MIN else _klines(start, 440))

    provider, _ = _provider(handler)
    chunks = list(provider.iter_chunks(BTC, D_2025_03_04, D_2025_03_04 + DAY))
    assert [c.via for c in chunks] == ["rest_fallback"]
    assert len(chunks[0].candles) == 1440


# --- Binance REST ---------------------------------------------------------------------------------

def test_rest_page_fixture_parses():
    provider, _ = _provider(lambda r: httpx.Response(200, content=_fixture("binance_rest_page.json")))
    candles = provider.fetch_rest(BTC, D_2025_03_04, D_2025_03_04 + 5 * MIN)
    assert candles.ts.tolist() == [D_2025_03_04 + i * MIN for i in range(5)]
    assert candles.close[0] == pytest.approx(86138.02)


def test_rest_pages_forward_and_keeps_only_closed_minutes():
    seen: list[int] = []
    now = D_2025_03_04 + 1500 * MIN + 30_000

    def handler(request: httpx.Request) -> httpx.Response:
        start = int(request.url.params["startTime"])
        seen.append(start)
        end = int(request.url.params["endTime"])
        n = min(1000, (end - start) // MIN + 2)
        return httpx.Response(200, json=_klines(start, n))

    provider, _ = _provider(handler, now_ms=lambda: now)
    candles = provider.fetch_rest(BTC, D_2025_03_04, D_2025_03_04 + 2 * DAY)
    assert seen == [D_2025_03_04, D_2025_03_04 + 1000 * MIN]
    assert int(candles.ts[-1]) + MIN <= now - 30_000
    assert len(candles) == 1500


def test_429_honours_retry_after_then_succeeds():
    spec = json.loads(_fixture("binance_429.json"))
    attempts = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        attempts["n"] += 1
        if attempts["n"] == 1:
            return httpx.Response(spec["status"], headers=spec["headers"], json=spec["body"])
        return httpx.Response(200, json=_klines(D_2025_03_04, 3))

    provider, waits = _provider(handler)
    candles = provider.fetch_rest(BTC, D_2025_03_04, D_2025_03_04 + 3 * MIN)
    assert len(candles) == 3
    assert 3.0 <= waits[0] <= 3.75


def test_persistent_429_raises_rate_limited():
    provider, waits = _provider(lambda r: httpx.Response(429, headers={"retry-after": "1"}))
    with pytest.raises(ProviderError) as exc:
        provider.fetch_rest(BTC, D_2025_03_04, D_2025_03_04 + 3 * MIN)
    assert exc.value.code == "rate_limited" and exc.value.retry_after_s == 1.0
    assert len(waits) == 5


def test_451_tries_alternate_host():
    hosts: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        hosts.append(request.url.host)
        if request.url.host == "api.binance.com":
            return httpx.Response(451)
        return httpx.Response(200, json=_klines(D_2025_03_04, 2))

    provider, _ = _provider(handler)
    assert len(provider.fetch_rest(BTC, D_2025_03_04, D_2025_03_04 + 2 * MIN)) == 2
    assert hosts == ["api.binance.com", "data-api.binance.vision"]
    hosts.clear()
    provider.fetch_rest(BTC, D_2025_03_04, D_2025_03_04 + 2 * MIN)
    assert hosts == ["data-api.binance.vision"]


def test_451_everywhere_fails_with_clear_error():
    provider, _ = _provider(lambda r: httpx.Response(451))
    with pytest.raises(ProviderError) as exc:
        provider.fetch_rest(BTC, D_2025_03_04, D_2025_03_04 + 2 * MIN)
    assert exc.value.code == "region_blocked" and not exc.value.retryable


def test_tls_failure_rotates_host():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "api.binance.com":
            raise httpx.ConnectError("tls handshake failed", request=request)
        return httpx.Response(200, json=_klines(D_2025_03_04, 2))

    provider, _ = _provider(handler)
    assert len(provider.fetch_rest(BTC, D_2025_03_04, D_2025_03_04 + 2 * MIN)) == 2


def test_high_used_weight_pauses():
    provider, waits = _provider(
        lambda r: httpx.Response(200, headers={"x-mbx-used-weight-1m": "5000"}, json=_klines(D_2025_03_04, 2))
    )
    provider.fetch_rest(BTC, D_2025_03_04, D_2025_03_04 + 2 * MIN)
    assert waits and 1 <= waits[0] <= 61


# --- Dukascopy ------------------------------------------------------------------------------------

def test_dukascopy_output_parses_and_validates():
    candles = parse_tool_output(_fixture("dukascopy_eurusd_m1.json").decode())
    assert len(candles) == 120 and candles.ts[0] == D_2025_03_04
    _, report = validate_batch(candles)
    assert report.rejected == {}
    assert len(parse_tool_output("")) == 0
    assert len(parse_tool_output("[[1741046400000,1.1,1.2,1.0,1.15,3]]")) == 1


def test_dukascopy_malformed_output_rejected():
    with pytest.raises(ProviderError) as exc:
        parse_tool_output(_fixture("dukascopy_malformed_truncated.json").decode())
    assert exc.value.code == "malformed_output"
    with pytest.raises(ProviderError):
        parse_tool_output('[{"timestamp": 1, "open": "x", "high": 1, "low": 1, "close": 1}]')
    with pytest.raises(ProviderError):
        parse_tool_output('{"timestamp": 1}')


def _tool_dir(tmp_path: Path) -> Path:
    cli = tmp_path / "node_modules/dukascopy-node/dist/cli/index.js"
    cli.parent.mkdir(parents=True)
    cli.write_text("")
    return tmp_path


def _runner(payload: str | None, calls: list | None = None, returncode: int = 0):
    def run(cmd, **kwargs):
        if calls is not None:
            calls.append(cmd)
        if payload is not None:
            out_dir = Path(cmd[cmd.index("-dir") + 1])
            (out_dir / "candles.json").write_text(payload)
        return subprocess.CompletedProcess(cmd, returncode, stdout="", stderr="boom" if returncode else "")

    return run


def test_dukascopy_command_and_weekly_chunks(tmp_path):
    calls: list = []
    provider = DukascopyProvider(
        runner=_runner(_fixture("dukascopy_eurusd_m1.json").decode(), calls),
        tool_dir=_tool_dir(tmp_path), node="node", chunk_days=7, now_ms=lambda: NOW,
    )
    chunks = list(provider.iter_chunks(EURUSD, D_2025_03_04, D_2025_03_04 + 2 * 3600_000))
    assert len(chunks) == 1 and len(chunks[0].candles) == 120
    cmd = calls[0]
    for flag, value in [("-i", "eurusd"), ("-t", "m1"), ("-p", "bid"), ("-utc", "0"), ("-f", "json"), ("-from", "2025-03-04"), ("-to", "2025-03-05")]:
        assert cmd[cmd.index(flag) + 1] == value
    assert "-fl" not in cmd and "-v" in cmd
    assert chunk_windows(_ms(2025, 3, 1, 5), _ms(2025, 3, 20), 7) == [
        (_ms(2025, 3, 1), _ms(2025, 3, 8)), (_ms(2025, 3, 8), _ms(2025, 3, 15)), (_ms(2025, 3, 15), _ms(2025, 3, 20)),
    ]


def test_dukascopy_bad_rows_fail_the_chunk(tmp_path):
    provider = DukascopyProvider(
        runner=_runner(_fixture("dukascopy_bad_rows.json").decode()), tool_dir=_tool_dir(tmp_path), node="node", now_ms=lambda: NOW
    )
    with pytest.raises(ProviderError) as exc:
        list(provider.iter_chunks(EURUSD, D_2025_03_04, D_2025_03_04 + DAY))
    assert exc.value.code == "invalid_output"


def test_dukascopy_empty_weekday_is_an_error_but_weekend_is_fine(tmp_path):
    provider = DukascopyProvider(runner=_runner(""), tool_dir=_tool_dir(tmp_path), node="node", now_ms=lambda: NOW)
    with pytest.raises(ProviderError) as exc:
        list(provider.iter_chunks(EURUSD, D_2025_03_04, D_2025_03_04 + DAY))
    assert exc.value.code == "provider_empty" and exc.value.retryable
    saturday = _ms(2025, 3, 8, 3)
    chunks = list(provider.iter_chunks(EURUSD, saturday, saturday + 12 * 3600_000))
    assert len(chunks) == 1 and len(chunks[0].candles) == 0


def test_dukascopy_failures(tmp_path, monkeypatch):
    provider = DukascopyProvider(runner=_runner(None, returncode=2), tool_dir=_tool_dir(tmp_path), node="node", now_ms=lambda: NOW)
    with pytest.raises(ProviderError) as exc:
        list(provider.iter_chunks(EURUSD, D_2025_03_04, D_2025_03_04 + DAY))
    assert exc.value.code == "provider_failed"
    missing = DukascopyProvider(tool_dir=tmp_path / "nowhere", node="node", now_ms=lambda: NOW)
    with pytest.raises(ProviderError) as exc:
        list(missing.iter_chunks(EURUSD, D_2025_03_04, D_2025_03_04 + DAY))
    assert exc.value.code == "tool_missing" and not exc.value.retryable
    from app.core.config import settings

    monkeypatch.setattr(settings, "dukascopy_enabled", False)
    with pytest.raises(ProviderError) as exc:
        list(provider.iter_chunks(EURUSD, D_2025_03_04, D_2025_03_04 + DAY))
    assert exc.value.code == "provider_disabled"


# --- verify-instrument ----------------------------------------------------------------------------

class _FakeProvider:
    name = "fake"

    def __init__(self, candles):
        self.candles = candles

    def iter_chunks(self, spec, start, end):
        from app.services.marketdata.providers.base import Chunk

        yield Chunk(start, end, self.candles(start), "fake")


def _day(start: int, price: float, n: int = 1440):
    rows = [(start + i * MIN, price, price * 1.001, price * 0.999, price, 1.0) for i in range(n)]
    from app.services.marketdata.candles import Candles

    return Candles.from_rows(rows)


def test_verify_instrument_accepts_a_plausible_day():
    result = verify_instrument(BTC, provider=_FakeProvider(lambda s: _day(s, 65000.0)), now_ms=NOW)
    assert result.ok, result.problems
    assert result.rows == 1440


def test_verify_instrument_flags_sparse_or_insane_days():
    sparse = verify_instrument(BTC, provider=_FakeProvider(lambda s: _day(s, 65000.0, 200)), now_ms=NOW)
    assert not sparse.ok and "open-market minutes" in sparse.problems[0]
    insane = verify_instrument(EURUSD, provider=_FakeProvider(lambda s: _day(s, 65000.0)), now_ms=NOW)
    assert any("sanity range" in p for p in insane.problems)


def test_verification_day_skips_weekends_for_forex():
    monday_noon = _ms(2025, 3, 10, 12)
    assert verification_day(EURUSD, monday_noon).isoformat() == "2025-03-06"
    assert verification_day(BTC, monday_noon).isoformat() == "2025-03-09"


def test_get_provider_unknown_source():
    with pytest.raises(ProviderError):
        get_provider("nasdaq")


# --- live smoke (not run by default) --------------------------------------------------------------

@pytest.mark.live
def test_live_binance_recent_day():
    result = verify_instrument(BTC)
    assert result.ok, result.problems


@pytest.mark.live
def test_live_dukascopy_recent_day():
    result = verify_instrument(EURUSD)
    assert result.ok, result.problems
