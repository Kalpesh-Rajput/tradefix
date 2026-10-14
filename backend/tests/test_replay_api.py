"""Replay payload builder, journal replay endpoint, replay notes and symbol interest (backtesting 2B)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

import numpy as np
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.api.deps import get_current_user
from app.core.db import get_db
from app.main import app
from app.models.job import Job
from app.models.market_data import UnresolvedSymbol
from app.models.time_offset import AccountTimeOffset
from app.models.trade import Trade, TradeSide, TradeStatus
from app.services.marketdata import candle_service, replay_service
from app.services.marketdata.cache import candle_cache
from app.services.marketdata.candles import MINUTE_MS, Candles
from app.services.marketdata.coverage import reset_coverage
from app.services.marketdata.providers.base import Chunk
from app.services.marketdata.registry import all_instruments, get_instrument, mirror_to_db
from app.services.marketdata.replay_service import default_timeframe, replay_window, suggested_start
from app.services.marketdata.resolver import resolve_symbol
from app.services.marketdata.store import LocalParquetStore
from tests.bt_support import db, make_account, make_user, requires_db  # noqa: F401

pytestmark = requires_db

UTC = timezone.utc
M = MINUTE_MS
H = 60 * M
D = 24 * H
T0 = int(datetime(2026, 2, 3, tzinfo=UTC).timestamp() * 1000)
ENTRY = datetime(2026, 2, 4, 10, 30, tzinfo=UTC)


def _price(ts):
    return 100 + (np.asarray(ts) - T0) / M * 0.01


def _minutes(start: int, end: int) -> Candles:
    ts = np.arange(start, end, M, dtype=np.int64)
    mid = _price(ts)
    return Candles.from_columns({"ts": ts, "open": mid, "high": mid + 0.5, "low": mid - 0.5, "close": mid, "volume": np.ones(ts.size)})


class FakeProvider:
    name = "fake"

    def iter_chunks(self, spec, start, end):
        yield Chunk(start, end, _minutes(start, end), "fake")


class Borrowed:
    def __init__(self, session):
        self._session = session

    def __getattr__(self, name):
        return getattr(self._session, name)

    def close(self):
        pass


def _enabled(symbol):
    spec = get_instrument(symbol)
    return spec.model_copy(update={"enabled": True}) if spec else None


@pytest.fixture()
def env(db, tmp_path, monkeypatch):  # noqa: F811
    mirror_to_db(db)
    for symbol in ("BTCUSDT", "EURUSD"):
        reset_coverage(db, symbol)
    db.execute(delete(Job))
    db.flush()
    candle_cache.clear()
    store = LocalParquetStore(tmp_path)
    monkeypatch.setattr(candle_service, "get_store", lambda: store)
    monkeypatch.setattr(replay_service, "get_store", lambda: store)
    monkeypatch.setattr(candle_service, "default_provider", lambda _s: FakeProvider())
    monkeypatch.setattr(candle_service, "_default_sessions", lambda: Borrowed(db))
    monkeypatch.setattr(
        replay_service, "resolve_symbol", lambda db_, broker, raw, **kw: resolve_symbol(db_, broker, raw, lookup=_enabled, **kw)
    )
    user = make_user(db)
    account = make_account(db, user)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        yield db, store, user, account, TestClient(app)
    finally:
        app.dependency_overrides.clear()


def _trade(db, user, account, *, symbol="BTCUSDT", opened=ENTRY, minutes=10, price=None, **kw):  # noqa: F811
    entry_ms = int(opened.timestamp() * 1000)
    trade = Trade(
        user_id=user.id,
        account_id=account.id,
        symbol=symbol,
        side=TradeSide.long,
        quantity=Decimal("0.5"),
        entry_price=Decimal(str(price if price is not None else round(float(_price(entry_ms)), 2))),
        exit_price=Decimal(str(round(float(_price(entry_ms + minutes * M)), 2))),
        opened_at=opened,
        closed_at=opened + timedelta(minutes=minutes),
        stop_loss=Decimal("90"),
        profit_target=Decimal("130"),
        fees=Decimal("1.5"),
        status=TradeStatus.closed,
        time_basis=kw.pop("time_basis", "utc_aware"),
        **kw,
    )
    db.add(trade)
    db.flush()
    return trade


@pytest.mark.parametrize(
    "duration,expected",
    [(5 * M, "1m"), (29 * M, "1m"), (45 * M, "5m"), (119 * M, "5m"), (3 * H, "15m"), (23 * H, "15m"), (2 * D, "1h"), (6 * D, "1h"), (8 * D, "4h")],
)
def test_default_timeframe_per_duration_class(duration, expected):
    assert default_timeframe(duration) == expected


def test_suggested_start_and_window():
    entry = T0 + 10 * H + 7 * M
    assert suggested_start(entry, "15m") == T0 + 10 * H - 100 * 15 * M
    assert suggested_start(entry, "1m") == entry - 100 * M
    start, end = replay_window(entry, entry + 30 * M, "5m", now_ms=T0 + 30 * D)
    assert start == entry - 200 * 5 * M - D and end == entry + 30 * M + 100 * 5 * M + D
    clipped = replay_window(entry, entry + 30 * M, "5m", now_ms=entry + H + 17)
    assert clipped[1] == entry + H


def test_journal_replay_ready_with_alignment_inside(env):
    db, store, user, account, client = env
    trade = _trade(db, user, account)
    response = client.get(f"/api/trades/{trade.id}/replay")
    assert response.status_code == 200, response.text
    body = response.json()
    entry_ms = int(ENTRY.timestamp() * 1000)
    assert body["status"] == "ready" and body["source"] == "journal" and body["trade_ref"] == str(trade.id)
    assert body["instrument"]["symbol"] == "BTCUSDT" and body["default_timeframe"] == "1m"
    assert body["trade"] == {
        "side": "long",
        "size": 0.5,
        "entry_ms": entry_ms,
        "entry_price": pytest.approx(float(trade.entry_price)),
        "exit_ms": entry_ms + 10 * M,
        "exit_price": pytest.approx(float(trade.exit_price)),
        "stop_loss": 90.0,
        "take_profit": 130.0,
        "fees": 1.5,
    }
    assert body["suggested_start_ms"] == entry_ms - 100 * M
    assert body["alignment"]["entry"]["status"] == "inside" and body["alignment"]["exit"]["status"] == "inside"
    assert body["alignment"]["offset_suggestion"] is None
    assert body["time_basis"] == {"basis": "utc_aware", "rule": "utc_aware", "tz_label": None}


def test_alignment_outside_suggests_offset(env):
    db, store, user, account, client = env
    entry_ms = int(ENTRY.timestamp() * 1000)
    high = float(_price(entry_ms)) + 0.5
    trade = _trade(db, user, account, price=round(high + 3.0, 2))
    body = client.get(f"/api/trades/{trade.id}/replay").json()
    entry = body["alignment"]["entry"]
    assert entry["status"] == "outside" and entry["outside_by"] == pytest.approx(3.0, abs=0.01)
    suggestion = body["alignment"]["offset_suggestion"]
    assert suggestion["based_on"] == "entry" and suggestion["price_delta"] == pytest.approx(-3.0, abs=0.01)
    spec = get_instrument("BTCUSDT")
    assert suggestion["points"] == pytest.approx(-3.0 / spec.pip_size, rel=1e-3)


def test_dukascopy_trade_is_preparing_with_job(env):
    db, store, user, account, client = env
    trade = _trade(db, user, account, symbol="EURUSD", price=1.1)
    body = client.get(f"/api/trades/{trade.id}/replay").json()
    assert body["status"] == "preparing" and body["job_id"] and body["alignment"] is None
    assert db.get(Job, body["job_id"]).type == "candles.ingest"


def test_unresolved_symbol_returns_stable_code(env):
    db, store, user, account, client = env
    trade = _trade(db, user, account, symbol="ZZQQ.X", source="api:mt5")
    response = client.get(f"/api/trades/{trade.id}/replay")
    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "unresolved_symbol" and body["message"] == "Replay isn't available for this symbol yet."
    assert body["details"] == {"raw_symbol": "ZZQQ.X", "broker": "mt5"}
    row = db.scalar(select(UnresolvedSymbol).where(UnresolvedSymbol.raw_symbol == "ZZQQ.X"))
    assert row.count >= 1


def test_disabled_instrument_is_not_supported(env, monkeypatch):
    db, store, user, account, client = env
    monkeypatch.setattr(
        replay_service, "resolve_symbol", lambda db_, broker, raw, **kw: resolve_symbol(db_, broker, raw, **kw)
    )
    disabled = next(s.symbol for s in all_instruments() if not s.enabled)
    trade = _trade(db, user, account, symbol=disabled, price=1.0)
    response = client.get(f"/api/trades/{trade.id}/replay")
    assert response.status_code == 422 and response.json()["code"] == "instrument_not_supported"


def test_simulated_and_foreign_trades_are_404(env):
    db, store, user, account, client = env
    simulated = _trade(db, user, account, is_simulated=True)
    assert client.get(f"/api/trades/{simulated.id}/replay").status_code == 404
    other = make_user(db)
    foreign = _trade(db, other, make_account(db, other))
    response = client.get(f"/api/trades/{foreign.id}/replay")
    assert response.status_code == 404 and response.json()["code"] == "not_found"


def test_naive_trade_uses_detected_offset(env):
    db, store, user, account, client = env
    db.add(
        AccountTimeOffset(
            account_id=account.id, user_id=user.id, tz_kind="iana", tz_value="Etc/GMT-2", confidence="high", method="price_match_v1"
        )
    )
    wall = (ENTRY + timedelta(hours=2)).replace(tzinfo=UTC)
    trade = _trade(db, user, account, opened=wall, time_basis="naive_wall_clock")
    body = client.get(f"/api/trades/{trade.id}/replay").json()
    assert body["time_basis"] == {"basis": "naive_wall_clock", "rule": "detected_offset", "tz_label": "Etc/GMT-2"}
    assert body["trade"]["entry_ms"] == int(ENTRY.timestamp() * 1000)


def test_notes_round_trip_and_are_user_scoped(env):
    db, store, user, account, client = env
    trade = _trade(db, user, account)
    entry_ms = int(ENTRY.timestamp() * 1000)
    later = client.post(f"/api/trades/{trade.id}/replay-notes", json={"replay_time_ms": entry_ms + 5 * M, "text": "  scaled out  "})
    first = client.post(f"/api/trades/{trade.id}/replay-notes", json={"replay_time_ms": entry_ms, "text": "entry looked late"})
    assert later.status_code == 201 and later.json()["text"] == "scaled out"
    listed = client.get(f"/api/trades/{trade.id}/replay-notes").json()
    assert [n["id"] for n in listed] == [first.json()["id"], later.json()["id"]]
    assert client.post(f"/api/trades/{trade.id}/replay-notes", json={"replay_time_ms": 1, "text": "   "}).status_code == 422
    assert client.post(f"/api/trades/{trade.id}/replay-notes", json={"replay_time_ms": 1, "text": "x" * 2001}).status_code == 422

    intruder = make_user(db)
    app.dependency_overrides[get_current_user] = lambda: intruder
    assert client.get(f"/api/trades/{trade.id}/replay-notes").status_code == 404
    assert client.post(f"/api/trades/{trade.id}/replay-notes", json={"replay_time_ms": 1, "text": "hi"}).status_code == 404
    assert client.get(f"/api/trades/{trade.id}/replay").status_code == 404


def test_symbol_interest_counts_requests(env):
    db, store, user, account, client = env
    for _ in range(2):
        response = client.post("/api/market-data/symbol-interest", json={"raw_symbol": "WEIRD1", "broker": "api:mt5"})
        assert response.status_code == 202 and response.json() == {"recorded": True}
    row = db.scalar(select(UnresolvedSymbol).where(UnresolvedSymbol.raw_symbol == "WEIRD1", UnresolvedSymbol.broker == "mt5"))
    assert row.interest_count == 2 and row.count == 0
    assert client.post("/api/market-data/symbol-interest", json={"raw_symbol": ""}).status_code == 422


def test_replay_requires_auth():
    client = TestClient(app)
    assert client.get("/api/trades/00000000-0000-0000-0000-000000000000/replay").status_code == 401
    assert client.post("/api/market-data/symbol-interest", json={"raw_symbol": "X"}).status_code == 401
