"""Prefetch on trade create/import/sync and time_basis writers (backtesting 2C)."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, func, select

from app.api.deps import get_current_user
from app.core.db import get_db
from app.main import app
from app.models.broker import BrokerAccount, BrokerConnection, ImportBatch, ImportRow
from app.models.job import Job
from app.models.trade import Trade
from app.services.brokers.canonical import CanonicalExecution
from app.services.csv_import_service import import_trades_from_csv
from app.services.imports.confirm import confirm_batch
from app.services.ingestion.persist import persist_executions
from app.services.marketdata import prefetch
from app.services.marketdata.coverage import record_fetch, reset_coverage
from app.services.marketdata.ingest_jobs import JOB_TYPE
from app.services.marketdata.registry import get_instrument, mirror_to_db
from app.services.marketdata.resolver import resolve_symbol
from app.services.marketdata.store import LocalParquetStore
from app.services.marketdata.time_offsets import basis_for_input, basis_for_provider
from tests.bt_support import db, make_account, make_user, requires_db  # noqa: F401
from tests.test_candle_api import _minutes

pytestmark = requires_db

UTC = timezone.utc
OPENED = datetime(2026, 2, 4, 10, 30, tzinfo=UTC)


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
def env(db, monkeypatch):  # noqa: F811
    mirror_to_db(db)
    for symbol in ("BTCUSDT", "EURUSD"):
        reset_coverage(db, symbol)
    db.execute(delete(Job))
    db.flush()
    monkeypatch.setattr(prefetch, "_default_sessions", lambda: Borrowed(db))
    monkeypatch.setattr(prefetch, "resolve_symbol", lambda db_, broker, raw, **kw: resolve_symbol(db_, broker, raw, lookup=_enabled, **kw))
    user = make_user(db)
    account = make_account(db, user)
    return db, user, account


def _ingest_jobs(db):  # noqa: F811
    return db.scalars(select(Job).where(Job.type == JOB_TYPE).order_by(Job.created_at)).all()


def _client(db, user):  # noqa: F811
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user
    return TestClient(app)


@pytest.fixture()
def cleanup_overrides():
    yield
    app.dependency_overrides.clear()


def _manual(client, account, opened_at: str, symbol: str = "BTCUSDT"):
    payload = {
        "symbol": symbol,
        "account_id": str(account.id),
        "asset_type": "crypto",
        "side": "long",
        "quantity": 0.5,
        "entry_price": 100,
        "exit_price": 101,
        "opened_at": opened_at,
        "closed_at": "2026-02-04T10:40:00Z",
        "status": "closed",
    }
    return client.post("/api/trades", json=payload)


def test_manual_create_enqueues_one_deduplicated_job(env, cleanup_overrides):
    db, user, account = env
    client = _client(db, user)
    first = _manual(client, account, "2026-02-04T10:30:00Z")
    assert first.status_code == 201, first.text
    trade = db.get(Trade, uuid.UUID(first.json()["id"]))
    assert trade.time_basis == "utc_aware"
    jobs = _ingest_jobs(db)
    assert len(jobs) == 1 and jobs[0].payload["symbol"] == "BTCUSDT" and jobs[0].lane == "binance"
    assert jobs[0].payload["start_ms"] < int(OPENED.timestamp() * 1000) < jobs[0].payload["end_ms"]
    assert _manual(client, account, "2026-02-04T10:31:00Z").status_code == 201
    assert len(_ingest_jobs(db)) == 1


def test_manual_naive_time_is_wall_clock(env, cleanup_overrides):
    db, user, account = env
    response = _manual(_client(db, user), account, "2026-02-04T10:30:00")
    assert db.get(Trade, uuid.UUID(response.json()["id"])).time_basis == "naive_wall_clock"


def test_edit_that_moves_times_prefetches_again(env, cleanup_overrides):
    db, user, account = env
    client = _client(db, user)
    created = _manual(client, account, "2026-02-04T10:30:00Z").json()
    moved = client.patch(f"/api/trades/{created['id']}", json={"opened_at": "2026-01-10T09:00:00Z", "closed_at": "2026-01-10T09:20:00Z"})
    assert moved.status_code == 200, moved.text
    assert len(_ingest_jobs(db)) == 2
    client.patch(f"/api/trades/{created['id']}", json={"notes": "just a note"})
    assert len(_ingest_jobs(db)) == 2


def test_hook_failure_never_fails_the_save(env, cleanup_overrides, monkeypatch):
    db, user, account = env

    def boom(*_args, **_kwargs):
        raise RuntimeError("prefetch exploded")

    monkeypatch.setattr(prefetch, "plan_windows", boom)
    response = _manual(_client(db, user), account, "2026-02-04T10:30:00Z")
    assert response.status_code == 201
    assert db.get(Trade, uuid.UUID(response.json()["id"])) is not None
    assert _ingest_jobs(db) == []


def test_covered_window_enqueues_nothing(env, tmp_path):
    db, user, account = env
    spec = get_instrument("BTCUSDT")
    start, end = int((OPENED - timedelta(days=3)).timestamp() * 1000), int((OPENED + timedelta(days=3)).timestamp() * 1000)
    record_fetch(db, LocalParquetStore(tmp_path), spec, start, end, _minutes(start, end))
    trade = Trade(
        user_id=user.id, account_id=account.id, symbol="BTCUSDT", quantity=1, entry_price=Decimal("100"),
        opened_at=OPENED, closed_at=OPENED + timedelta(minutes=10), time_basis="utc_aware",
    )
    db.add(trade)
    db.flush()
    assert prefetch.prefetch_for_trades([trade.id]) == []


def test_unresolved_symbol_is_logged_not_fetched(env):
    db, user, account = env
    from app.models.market_data import UnresolvedSymbol

    trade = Trade(user_id=user.id, account_id=account.id, symbol="QQZZ", quantity=1, entry_price=Decimal("5"), opened_at=OPENED)
    db.add(trade)
    db.flush()
    assert prefetch.prefetch_for_trades([trade.id]) == []
    assert db.scalar(select(UnresolvedSymbol).where(UnresolvedSymbol.raw_symbol == "QQZZ")) is not None


def test_simulated_trades_are_skipped(env):
    db, user, account = env
    trade = Trade(
        user_id=user.id, account_id=account.id, symbol="BTCUSDT", quantity=1, entry_price=Decimal("100"),
        opened_at=OPENED, is_simulated=True,
    )
    db.add(trade)
    db.flush()
    assert prefetch.prefetch_for_trades([trade.id]) == []


def test_legacy_csv_import(env):
    db, user, account = env
    csv = (
        "symbol,side,quantity,entry_price,exit_price,opened_at,closed_at\n"
        "BTCUSDT,buy,1,100,101,2026-02-04 10:30:00,2026-02-04 10:45:00\n"
        "BTCUSDT,buy,1,100,102,2026-02-04 11:30:00,2026-02-04 11:45:00\n"
    ).encode()
    imported, _dupes, errors, ids = import_trades_from_csv(db, user, account, csv)
    assert imported == 2 and errors == []
    assert {db.get(Trade, i).time_basis for i in ids} == {"naive_wall_clock"}
    assert len(_ingest_jobs(db)) == 1
    import_trades_from_csv(db, user, account, csv.replace(b"10:30", b"10:31").replace(b"11:30", b"11:31"))
    assert len(_ingest_jobs(db)) == 1


def _batch(db, user, account, rows):  # noqa: F811
    batch = ImportBatch(user_id=user.id, account_id=account.id, filename="t.csv", detected_format="generic-csv", status="preview")
    db.add(batch)
    db.flush()
    for number, normalized in enumerate(rows, start=1):
        db.add(ImportRow(user_id=user.id, batch_id=batch.id, row_number=number, status="valid", normalized=normalized))
    db.flush()
    return batch


def test_file_import_confirm(env):
    db, user, account = env
    batch = _batch(
        db,
        user,
        account,
        [
            {"symbol": "BTCUSDT", "side": "buy", "quantity": "1", "price": "100", "exit_price": "101",
             "executed_at": "2026-02-04T10:30:00", "closed_at": "2026-02-04T10:40:00", "external_id": "n1"},
            {"symbol": "EURUSD", "side": "buy", "quantity": "1", "price": "1.1", "exit_price": "1.2",
             "executed_at": "2026-02-05T10:30:00+00:00", "closed_at": "2026-02-05T10:40:00+00:00", "external_id": "a1"},
        ],
    )
    result = confirm_batch(db, user, batch)
    assert result["created"] == 2
    trades = {t.symbol: t for t in db.scalars(select(Trade).where(Trade.account_id == account.id))}
    assert trades["BTCUSDT"].time_basis == "naive_wall_clock" and trades["EURUSD"].time_basis == "utc_aware"
    lanes = sorted(job.lane for job in _ingest_jobs(db))
    assert lanes == ["binance", "dukascopy"]


def _broker(db, user, account, provider):  # noqa: F811
    connection = BrokerConnection(user_id=user.id, provider=provider, display_name=provider, status="syncing")
    db.add(connection)
    db.flush()
    broker_account = BrokerAccount(
        user_id=user.id, connection_id=connection.id, account_id=account.id, external_account_id=f"x-{provider}", masked_id="****"
    )
    db.add(broker_account)
    db.flush()
    return broker_account


@pytest.mark.parametrize("provider,symbol,basis", [("binance", "BTCUSDT", "utc_aware"), ("mt5", "EURUSD.pro", "naive_wall_clock")])
def test_broker_sync(env, provider, symbol, basis):
    db, user, account = env
    broker_account = _broker(db, user, account, provider)
    rows = [
        CanonicalExecution("e1", symbol, "buy", Decimal("1"), Decimal("1.1"), OPENED, external_position_id="p1"),
        CanonicalExecution("e2", symbol, "sell", Decimal("1"), Decimal("1.2"), OPENED + timedelta(minutes=20), external_position_id="p1"),
    ]
    for _ in range(2):
        persist_executions(
            db, user_id=user.id, broker_account_id=broker_account.id, journal_account_id=account.id,
            provider=provider, rows=rows, sync_run_id=None,
        )
    trade = db.scalar(select(Trade).where(Trade.broker_account_id == broker_account.id))
    assert trade.time_basis == basis
    assert db.scalar(select(func.count()).select_from(Job).where(Job.type == JOB_TYPE)) == 1


def test_basis_rules():
    assert basis_for_input(datetime(2026, 1, 1)) == "naive_wall_clock"
    assert basis_for_input(datetime(2026, 1, 1, tzinfo=UTC)) == "utc_aware"
    assert basis_for_input(None) == "unknown"
    assert [basis_for_provider(p) for p in ("MT5", "xm", "binance", "ctrader")] == [
        "naive_wall_clock", "naive_wall_clock", "utc_aware", "utc_aware",
    ]
