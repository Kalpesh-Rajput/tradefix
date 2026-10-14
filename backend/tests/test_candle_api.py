"""Candle API, health, gzip and the operator workflows (backtesting 1H, Gate 1 AUTO checks)."""

from __future__ import annotations

import csv
import gzip
import io
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import numpy as np
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.db import get_db
from app.core.security import create_access_token
from app.main import app
from app.models.job import Job
from app.models.trade import Trade, TradeStatus
from app.services.jobs import queue
from app.services.marketdata import candle_service, operations, read_api
from app.services.marketdata.cache import candle_cache
from app.services.marketdata.candles import MINUTE_MS, Candles
from app.services.marketdata.coverage import covered_ranges, record_fetch, reset_coverage
from app.services.marketdata.providers.base import Chunk
from app.services.marketdata.registry import get_instrument, mirror_to_db
from app.services.marketdata.store import LocalParquetStore
from tests.bt_support import db, make_account, make_user, requires_db  # noqa: F401

pytestmark = requires_db

H = 3_600_000
T0 = int(datetime(2026, 2, 3, tzinfo=timezone.utc).timestamp() * 1000)


def _minutes(start: int, end: int) -> Candles:
    ts = np.arange(start, end, MINUTE_MS, dtype=np.int64)
    price = 100 + (ts - T0) / MINUTE_MS * 0.01
    return Candles.from_columns(
        {"ts": ts, "open": price, "high": price + 0.5, "low": price - 0.5, "close": price + 0.1, "volume": np.ones(ts.size)}
    )


class FakeProvider:
    name = "fake"

    def __init__(self):
        self.calls: list[tuple[int, int]] = []

    def iter_chunks(self, spec, start, end):
        self.calls.append((start, end))
        day = 86_400_000
        cursor = start
        while cursor < end:
            stop = min(end, cursor - cursor % day + day)
            yield Chunk(cursor, stop, _minutes(cursor, stop), "fake")
            cursor = stop


class Borrowed:
    def __init__(self, session):
        self._session = session

    def __getattr__(self, name):
        return getattr(self._session, name)

    def close(self):
        pass


def _enabled(symbol: str):
    spec = get_instrument(symbol)
    return spec.model_copy(update={"enabled": True}) if spec else None


@pytest.fixture()
def env(db, tmp_path, monkeypatch):  # noqa: F811
    mirror_to_db(db)
    for symbol in ("BTCUSDT", "EURUSD", "XAUUSD"):
        reset_coverage(db, symbol)
    db.execute(delete(Job))
    db.flush()
    candle_cache.clear()
    store = LocalParquetStore(tmp_path)
    provider = FakeProvider()
    monkeypatch.setattr(candle_service, "get_store", lambda: store)
    monkeypatch.setattr(candle_service, "default_provider", lambda _source: provider)
    monkeypatch.setattr(candle_service, "_default_sessions", lambda: Borrowed(db))
    monkeypatch.setattr(read_api, "get_instrument", _enabled)
    user = make_user(db)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        yield db, store, provider, user, TestClient(app)
    finally:
        app.dependency_overrides.clear()


def _get(client, **params):
    base = {"symbol": "BTCUSDT", "timeframe": "1m", "start": T0, "end": T0 + 2 * H}
    return client.get("/api/market-data/candles", params={**base, **params})


def test_candles_require_auth():
    client = TestClient(app)
    response = client.get("/api/market-data/candles", params={"symbol": "BTCUSDT", "start": T0, "end": T0 + H})
    assert response.status_code == 401
    assert client.get("/api/market-data/instruments").status_code == 401


def test_candles_shape_and_inline_fill(env):
    db, store, provider, user, client = env
    response = _get(client)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "ready" and body["symbol"] == "BTCUSDT" and body["timeframe"] == "1m"
    assert len(body["t"]) == 120 and body["t"][0] == T0 and body["t"][1] - body["t"][0] == MINUTE_MS
    assert {len(body[k]) for k in "ohlcv"} == {120}
    assert body["earliest_ms"] == T0 and body["complete_until_ms"] == T0 + 2 * H
    assert provider.calls == [(T0, T0 + 2 * H)]
    again = _get(client)
    assert again.json() == body and len(provider.calls) == 1


def test_iso_bounds_and_aggregated_timeframe(env):
    db, store, provider, user, client = env
    response = _get(client, timeframe="15m", start="2026-02-03T00:00:00Z", end="2026-02-03T02:00:00")
    body = response.json()
    assert response.status_code == 200 and len(body["t"]) == 8
    raw = _minutes(T0, T0 + 15 * MINUTE_MS)
    assert body["o"][0] == pytest.approx(raw.open[0]) and body["c"][0] == pytest.approx(raw.close[-1])
    assert body["h"][0] == pytest.approx(raw.high.max()) and body["v"][0] == 15


def test_limits_are_applied(env, monkeypatch):
    db, store, provider, user, client = env
    monkeypatch.setattr(settings, "candle_max_bars_per_request", 50)
    body = _get(client, limit=500).json()
    assert len(body["t"]) == 50 and body["has_more_after"] is True
    assert len(_get(client, limit=10).json()["t"]) == 10
    until = _get(client, until=T0 + 30 * MINUTE_MS).json()
    assert len(until["t"]) == 30 and until["complete_until_ms"] == T0 + 30 * MINUTE_MS


def test_bad_requests_use_the_error_shape(env):
    db, store, provider, user, client = env
    bad_tf = _get(client, timeframe="7m")
    assert bad_tf.status_code == 422 and bad_tf.json()["code"] == "invalid_request"
    assert _get(client, start="yesterday").json()["code"] == "invalid_request"
    assert _get(client, end=T0).json()["code"] == "invalid_request"
    unknown = _get(client, symbol="NOPE123")
    assert unknown.status_code == 422 and unknown.json()["code"] == "instrument_not_supported"


def test_rate_limit_per_user(env, monkeypatch):
    db, store, provider, user, client = env
    monkeypatch.setattr(settings, "candle_requests_per_minute", 2)
    assert _get(client).status_code == 200
    assert _get(client).status_code == 200
    limited = _get(client)
    assert limited.status_code == 429 and limited.json()["code"] == "rate_limited"
    assert limited.headers["retry-after"] == "10"


def test_gzip_is_active_on_candles(env):
    db, store, provider, user, client = env
    response = _get(client)
    assert response.request.headers["accept-encoding"].startswith("gzip")
    assert response.headers.get("content-encoding") == "gzip"
    assert len(response.json()["t"]) == 120


def test_preparing_then_polled_until_ready(env):
    db, store, provider, user, client = env
    first = _get(client, symbol="EURUSD")
    assert first.status_code == 202
    body = first.json()
    assert body["code"] == "data_preparing" and body["job_id"]
    assert first.headers["retry-after"] == "2"
    job = client.get(f"/api/market-data/jobs/{body['job_id']}")
    assert job.status_code == 200 and job.json()["status"] == "queued" and job.json()["type"] == "candles.ingest"
    spec = get_instrument("EURUSD")
    record_fetch(db, store, spec, T0, T0 + 2 * H, _minutes(T0, T0 + 2 * H))
    db.flush()
    ready = _get(client, symbol="EURUSD")
    assert ready.status_code == 200 and len(ready.json()["t"]) == 120


def test_backtest_jobs_hidden_from_other_users(env):
    db, store, provider, user, client = env
    other = make_user(db)
    hidden = queue.enqueue(db, type="backtest.run", lane="backtest", payload={}, owner_user_id=other.id).job
    mine = queue.enqueue(db, type="backtest.run", lane="backtest", payload={}, owner_user_id=user.id).job
    db.flush()
    assert client.get(f"/api/market-data/jobs/{hidden.id}").status_code == 404
    assert client.get(f"/api/market-data/jobs/{mine.id}").status_code == 200
    assert client.get("/api/market-data/jobs/00000000-0000-0000-0000-000000000000").status_code == 404


def test_instruments_lists_enabled_only(env, monkeypatch):
    db, store, provider, user, client = env
    assert all(i["enabled"] for i in client.get("/api/market-data/instruments").json())
    enabled = [_enabled("BTCUSDT"), _enabled("EURUSD"), get_instrument("XAUUSD")]
    monkeypatch.setattr(read_api, "all_instruments", lambda: enabled)
    listed = client.get("/api/market-data/instruments").json()
    assert [i["symbol"] for i in listed] == ["BTCUSDT", "EURUSD"]
    assert "provider_id" not in listed[0]
    crypto = client.get("/api/market-data/instruments", params={"asset_class": "crypto"}).json()
    assert [i["symbol"] for i in crypto] == ["BTCUSDT"]


def test_health_reports_checks():
    body = TestClient(app).get("/api/health").json()
    assert body["app"] == settings.app_name
    assert body["checks"]["database"] == "ok" and body["checks"]["storage"] == "ok"
    assert body["checks"]["market_worker"] in {"ok", "stale", "missing"}
    assert body["status"] in {"ok", "degraded"}


def _trades(db, user, account, n: int = 60):  # noqa: F811
    opened = datetime(2026, 1, 5, 9, tzinfo=timezone.utc)
    for i in range(n):
        db.add(
            Trade(
                user_id=user.id,
                account_id=account.id,
                symbol="EURUSD",
                quantity=1,
                entry_price=Decimal("1.1"),
                exit_price=Decimal("1.2"),
                opened_at=opened + timedelta(hours=i),
                closed_at=opened + timedelta(hours=i, minutes=30),
                pnl=Decimal(str(10 if i % 2 else -5)),
                fees=Decimal("1"),
                status=TradeStatus.closed,
                notes=f"trade note number {i} with enough text to make the export larger than a kilobyte",
                setup_tags=[f"SETUP{i}"],
            )
        )
    db.flush()


def _rows(text: str) -> list[list[str]]:
    return list(csv.reader(io.StringIO(text.lstrip("\ufeff"))))


def test_csv_streams_complete_under_gzip(env):
    db, store, provider, user, client = env
    account = make_account(db, user)
    _trades(db, user, account)
    headers = {"Accept-Encoding": "gzip"}

    history = client.get(f"/api/accounts/{account.id}/export", headers=headers)
    assert history.status_code == 200 and history.headers.get("content-encoding") == "gzip"
    assert len(_rows(history.text)) == 61

    expectancy = client.get("/api/analytics/expectancy-export", headers=headers)
    assert expectancy.status_code == 200 and expectancy.headers.get("content-encoding") == "gzip"
    assert len(_rows(expectancy.text)) == 61

    export = client.post("/api/trades/export", json={"format": "csv", "scope": "all"}, headers=headers)
    assert export.status_code == 200, export.text
    assert export.headers.get("content-encoding") == "gzip"
    assert len(_rows(export.text)) == 61


def test_gzip_body_decodes_to_the_same_bytes(env):
    db, store, provider, user, client = env
    account = make_account(db, user)
    _trades(db, user, account)
    plain = client.get(f"/api/accounts/{account.id}/export", headers={"Accept-Encoding": "identity"})
    assert "content-encoding" not in plain.headers
    with client.stream("GET", f"/api/accounts/{account.id}/export", headers={"Accept-Encoding": "gzip"}) as raw:
        compressed = b"".join(raw.iter_raw())
    assert gzip.decompress(compressed) == plain.content


def test_account_websocket_still_works(db):  # noqa: F811
    user = make_user(db)
    client = TestClient(app)
    with client.websocket_connect(f"/ws/account?token={create_access_token(str(user.id))}") as ws:
        assert ws.receive_json() == {"type": "connected", "user_id": str(user.id)}


def test_backfill_twice_is_idempotent(env):
    db, store, provider, user, client = env
    spec = get_instrument("BTCUSDT")
    start, end = T0, T0 + 2 * 86_400_000
    first = operations.backfill(db, spec, start, end, store=store, provider_factory=lambda _s: provider)
    path = store.month_path("binance", "BTCUSDT", 2026, 2)
    before = path.read_bytes()
    assert first.rows == 2880 and covered_ranges(db, "BTCUSDT", "binance") == [(start, end)]
    second = operations.backfill(db, spec, start, end, store=store, provider_factory=lambda _s: provider)
    assert second.gaps == [] and second.rows == 0 and len(provider.calls) == 1
    assert path.read_bytes() == before
    reset_coverage(db, "BTCUSDT")
    third = operations.backfill(db, spec, start, end, store=store, provider_factory=lambda _s: provider)
    assert third.rows == 2880 and store.count("binance", "BTCUSDT", start, end) == 2880
    checks = operations.verify_stored(db, spec, store)
    assert [(c.month, c.rows, c.problems, c.gap_minutes) for c in checks] == [("2026-02", 2880, [], 0)]


def test_top_up_and_coverage_report(env):
    db, store, provider, user, client = env
    spec = get_instrument("BTCUSDT")
    day = 86_400_000
    operations.backfill(db, spec, T0, T0 + day, store=store, provider_factory=lambda _s: provider)
    summary = operations.top_up(
        db, store=store, provider_factory=lambda _s: provider, now_ms=T0 + 2 * day + H, specs=[spec, get_instrument("EURUSD")]
    )
    assert summary[0] == {"symbol": "BTCUSDT", "status": "updated", "rows": 1440, "error": None}
    assert summary[1]["status"] == "skipped"
    assert covered_ranges(db, "BTCUSDT", "binance") == [(T0, T0 + 2 * day)]
    again = operations.top_up(db, store=store, provider_factory=lambda _s: provider, now_ms=T0 + 2 * day + H, specs=[spec])
    assert again == [{"symbol": "BTCUSDT", "status": "up_to_date"}]
    report = operations.coverage_report(db, spec)
    assert report.ranges == [{"from": T0, "to": T0 + 2 * day}] and report.holes == []
    assert report.months[0]["month"] == "2026-02" and report.months[0]["rows"] == 2880


def test_previous_full_month_and_preload_range():
    now = int(datetime(2026, 1, 14, 5, tzinfo=timezone.utc).timestamp() * 1000)
    start, end = operations.previous_full_month(now)
    assert datetime.fromtimestamp(start / 1000, tz=timezone.utc) == datetime(2025, 12, 1, tzinfo=timezone.utc)
    assert datetime.fromtimestamp(end / 1000, tz=timezone.utc) == datetime(2026, 1, 1, tzinfo=timezone.utc)
    spec = get_instrument("BTCUSDT")
    p_start, p_end = operations.preload_range(spec, now)
    assert datetime.fromtimestamp(p_end / 1000, tz=timezone.utc) == datetime(2026, 1, 14, tzinfo=timezone.utc)
    assert datetime.fromtimestamp(p_start / 1000, tz=timezone.utc).year == 2026 - spec.preload_years
