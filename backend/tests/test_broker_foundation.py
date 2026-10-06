import base64
import os
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest

from app.services.brokers.canonical import canonical_symbol, fingerprint
from app.services.brokers.errors import message_for
from app.services.brokers.providers.binance import BinanceConnector
from app.services.brokers.providers.mt_bridge import MtBridgeConnector
from app.services.brokers.redact import redact
from app.services.brokers.registry import get_provider
from app.services.brokers.signing import delta_signature
from app.services.brokers.http import ProviderHttp
from app.services.sync.engine import decode_cursor, encode_cursor, retry_delay_seconds
from app.services.brokers.base import BaseBrokerConnector
from app.services.brokers.errors import NotSupportedError
from app.services.brokers.vault import decrypt, encrypt, rotate
from app.services.brokers.windows import chunk_range
from app.services.imports.parse import parse_upload
from app.services.ingestion.grouping import group_executions
from app.services.brokers.canonical import CanonicalExecution


def test_delta_signature_uses_documented_prehash():
    # Docs: method + timestamp + path + ?query + body.
    # The sample secret printed next to signature ad767f… does not reproduce that digest
    # (the secret in the public snippet looks truncated), so this locks the prehash we send.
    signature = delta_signature(
        secret="7b6f39dcf660ec1c7c664f612c60410a2bd0c258416b498bf0311f94228f",
        method="GET",
        timestamp="1542110948",
        path="/v2/orders",
        query="product_id=1&state=open",
        body="",
    )
    assert signature == "4e38dda3e6477092f360ba70399266d8145630b22bcc34c0ec7f804d5746877a"


def test_canonical_symbol_keeps_pair_and_strips_suffix():
    assert canonical_symbol("EURUSD.a") == "EURUSD"
    assert canonical_symbol("BTC-USDT") == "BTCUSDT"


def test_fingerprint_is_stable():
    when = datetime(2026, 1, 2, 3, 4, 5, 6000, tzinfo=timezone.utc)
    first = fingerprint(
        provider="binance",
        account_id="a",
        provider_symbol="BTCUSDT",
        side="buy",
        quantity=Decimal("1.5"),
        price=Decimal("100"),
        executed_at=when,
    )
    second = fingerprint(
        provider="binance",
        account_id="a",
        provider_symbol="BTCUSDT",
        side="buy",
        quantity=Decimal("1.5"),
        price=Decimal("100"),
        executed_at=when,
    )
    assert first == second


def test_history_windows_are_bounded():
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    end = start + timedelta(days=30)
    chunks = chunk_range(start, end, window=timedelta(days=7))
    assert len(chunks) == 5
    assert chunks[0][0] == start
    assert chunks[-1][1] == end


def test_xtb_has_no_broker_sync():
    xtb = get_provider("xtb")
    assert "broker_sync" not in xtb.methods
    assert xtb.capabilities["direct_api"] == "discontinued_2025_03_14"
    assert "broker_sync" in get_provider("binance").methods


def test_secrets_are_redacted_and_not_in_messages():
    cleaned = redact({"password": "hunter2", "login": "100"})
    assert cleaned["password"] == "***"
    assert "hunter2" not in message_for("INVALID_CREDENTIALS", "password=hunter2")


def test_vault_round_trip(monkeypatch):
    key = base64.b64encode(os.urandom(32)).decode()
    monkeypatch.setenv("BROKER_CREDENTIALS_KEYS", f"local:{key}")
    monkeypatch.setenv("BROKER_CREDENTIALS_ACTIVE_KEY", "local")
    from app.core.config import get_settings

    get_settings.cache_clear()
    import app.core.config as config

    monkeypatch.setattr(config, "settings", get_settings())
    import app.services.brokers.vault as vault

    monkeypatch.setattr(vault, "settings", get_settings())
    connection_id = uuid.uuid4()
    key_id, nonce, ciphertext = encrypt({"api_secret": "s3cret"}, connection_id)
    assert b"s3cret" not in ciphertext
    assert decrypt(key_id, nonce, ciphertext, connection_id)["api_secret"] == "s3cret"
    with pytest.raises(Exception):
        decrypt(key_id, nonce, ciphertext, uuid.uuid4())
    get_settings.cache_clear()


def test_partial_close_stays_one_position():
    when = datetime(2026, 2, 1, tzinfo=timezone.utc)
    rows = [
        CanonicalExecution("1", "EURUSD.pro", "buy", Decimal("1"), Decimal("1.1"), when, external_position_id="p1"),
        CanonicalExecution(
            "2",
            "EURUSD.pro",
            "sell",
            Decimal("0.4"),
            Decimal("1.2"),
            when + timedelta(hours=1),
            external_position_id="p1",
        ),
        CanonicalExecution(
            "3",
            "EURUSD.pro",
            "sell",
            Decimal("0.6"),
            Decimal("1.3"),
            when + timedelta(hours=2),
            external_position_id="p1",
        ),
    ]
    drafts = group_executions(rows, provider="mt5", account_key="acc")
    assert len(drafts) == 1
    assert drafts[0].status == "closed"
    assert drafts[0].canonical == "EURUSD"
    assert len(drafts[0].executions) == 3


def test_fifo_matches_spot_round_trip_once():
    when = datetime(2026, 3, 1, tzinfo=timezone.utc)
    rows = [
        CanonicalExecution("a", "BTCUSDT", "buy", Decimal("2"), Decimal("10"), when),
        CanonicalExecution("b", "BTCUSDT", "sell", Decimal("2"), Decimal("12"), when + timedelta(minutes=5)),
    ]
    drafts = group_executions(rows, provider="binance", account_key="acc")
    assert len(drafts) == 1
    assert drafts[0].net_pnl == Decimal("4")


def test_mt_bridge_refuses_without_configuration(monkeypatch):
    monkeypatch.setattr("app.services.brokers.providers.mt_bridge.settings.tradefix_mt_bridge_url", "")
    with pytest.raises(Exception) as caught:
        MtBridgeConnector("mt5").validate({"login": "1", "password": "x", "server": "Demo"})
    assert caught.value.code == "BRIDGE_NOT_CONFIGURED"


def test_binance_user_stream_does_not_use_listen_key():
    payload = BinanceConnector().user_stream_request({"api_key": "k", "api_secret": "s"})
    assert payload["method"] == "userDataStream.subscribe.signature"
    assert "listenKey" not in payload["method"]


def test_unsupported_methods_do_not_return_empty_rows():
    with pytest.raises(NotSupportedError):
        BinanceConnector().get_open_orders({})
    with pytest.raises(NotSupportedError):
        BinanceConnector().start_realtime({})
    with pytest.raises(NotSupportedError):
        BaseBrokerConnector().get_open_positions({})


def test_registry_flags_match_implemented_methods():
    binance = get_provider("binance")
    assert binance.auth_type == "api_key"
    flags = binance.public()["capability_flags"]
    assert flags["historical_trades"] is True
    assert flags["realtime"] is False
    assert flags["positions"] is False
    assert flags["orders"] is False
    assert flags["file_import"] is True
    exness = get_provider("exness")
    assert "Vietnam" in " ".join(exness.limitations)
    assert exness.public()["limits"]["history_window_days"] is None


def test_key_rotation_keeps_old_ciphertext_readable(monkeypatch):
    first = base64.b64encode(os.urandom(32)).decode()
    second = base64.b64encode(os.urandom(32)).decode()
    monkeypatch.setenv("BROKER_CREDENTIALS_KEYS", f"v1:{first},v2:{second}")
    monkeypatch.setenv("BROKER_CREDENTIALS_ACTIVE_KEY", "v1")
    from app.core.config import get_settings

    get_settings.cache_clear()
    import app.core.config as config
    import app.services.brokers.vault as vault

    monkeypatch.setattr(config, "settings", get_settings())
    monkeypatch.setattr(vault, "settings", get_settings())
    connection_id = uuid.uuid4()
    key_id, nonce, ciphertext = encrypt({"api_secret": "s3cret"}, connection_id)
    assert key_id == "v1"
    monkeypatch.setenv("BROKER_CREDENTIALS_ACTIVE_KEY", "v2")
    get_settings.cache_clear()
    monkeypatch.setattr(config, "settings", get_settings())
    monkeypatch.setattr(vault, "settings", get_settings())
    new_id, new_nonce, new_ciphertext = rotate(key_id, nonce, ciphertext, connection_id)
    assert new_id == "v2"
    assert decrypt(key_id, nonce, ciphertext, connection_id)["api_secret"] == "s3cret"
    assert decrypt(new_id, new_nonce, new_ciphertext, connection_id)["api_secret"] == "s3cret"
    get_settings.cache_clear()


def test_checkpoint_round_trip_keeps_window_and_cursor():
    raw = encode_cursor({"window": 3, "cursor": "abc", "symbols": ["BTCUSDT"]})
    restored = decode_cursor(raw)
    assert restored["window"] == 3
    assert restored["cursor"] == "abc"
    assert restored["symbols"] == ["BTCUSDT"]
    assert decode_cursor("legacy-cursor")["cursor"] == "legacy-cursor"


def test_retry_delay_is_capped_and_jittered():
    delays = [retry_delay_seconds(9) for _ in range(20)]
    assert all(300 < delay < 301 for delay in delays)
    assert len(set(delays)) > 1


def test_request_budget_stops_before_the_network():
    client = ProviderHttp("binance", min_interval=0, budget=1)
    client._used = 1
    with pytest.raises(Exception) as caught:
        client.request("GET", "https://api.binance.com/api/v3/time")
    assert caught.value.code == "RATE_LIMITED"


def test_ten_identical_executions_stay_one_row():
    from sqlalchemy import func, select, text

    from app.core.db import SessionLocal
    from app.models.account import Account
    from app.models.broker import BrokerAccount, BrokerConnection, BrokerExecution, BrokerPosition, RawProviderRecord
    from app.models.trade import Trade
    from app.models.user import User
    from app.services.brokers.canonical import CanonicalExecution
    from app.services.ingestion.persist import persist_executions

    db = SessionLocal()
    email = f"sync-idem-{uuid.uuid4()}@example.com"
    user_id = None
    try:
        user = User(email=email, name="Sync idempotency")
        db.add(user)
        db.flush()
        user_id = user.id
        journal = Account(user_id=user.id, name="Journal", base_currency="USD", source="broker")
        db.add(journal)
        db.flush()
        connection = BrokerConnection(user_id=user.id, provider="binance", display_name="Binance", status="syncing")
        db.add(connection)
        db.flush()
        broker_account = BrokerAccount(
            user_id=user.id,
            connection_id=connection.id,
            account_id=journal.id,
            external_account_id="spot",
            masked_id="****spot",
            currency="USDT",
        )
        db.add(broker_account)
        db.commit()
        when = datetime(2026, 4, 1, tzinfo=timezone.utc)
        row = CanonicalExecution("fill-1", "BTCUSDT", "buy", Decimal("1"), Decimal("10"), when, external_order_id="ord-1")
        for _ in range(10):
            persist_executions(
                db,
                user_id=user.id,
                broker_account_id=broker_account.id,
                journal_account_id=journal.id,
                provider="binance",
                rows=[row],
                sync_run_id=None,
            )
        count = db.scalar(
            select(func.count()).select_from(BrokerExecution).where(BrokerExecution.broker_account_id == broker_account.id)
        )
        trades = db.scalar(select(func.count()).select_from(Trade).where(Trade.broker_account_id == broker_account.id))
        assert count == 1
        assert trades == 1
    finally:
        if user_id is not None:
            db.execute(text("SELECT set_config('tradefix.allow_raw_delete', 'on', true)"))
            db.query(RawProviderRecord).filter(RawProviderRecord.user_id == user_id).delete(synchronize_session=False)
            db.query(BrokerPosition).filter(BrokerPosition.user_id == user_id).delete(synchronize_session=False)
            db.query(BrokerExecution).filter(BrokerExecution.user_id == user_id).delete(synchronize_session=False)
            db.query(Trade).filter(Trade.user_id == user_id).delete(synchronize_session=False)
            db.query(BrokerAccount).filter(BrokerAccount.user_id == user_id).delete(synchronize_session=False)
            db.query(BrokerConnection).filter(BrokerConnection.user_id == user_id).delete(synchronize_session=False)
            db.query(Account).filter(Account.user_id == user_id).delete(synchronize_session=False)
            db.query(User).filter(User.id == user_id).delete(synchronize_session=False)
            db.commit()
        db.close()


def test_mt4_html_parser_keeps_ticket():
    html = """
    <html><body>
    <b>Closed Transactions</b>
    <table><tr><td>Ticket</td></tr>
    <tr><td>1001</td><td>2024.01.02 10:00:00</td><td>buy</td><td>0.10</td><td>EURUSD</td>
    <td>1.1000</td><td>0</td><td>0</td><td>2024.01.02 12:00:00</td><td>1.1050</td><td>-1.00</td><td>0</td><td>-0.20</td><td>5</td></tr>
    </table></body></html>
    """
    kind, rows = parse_upload("statement.htm", html.encode())
    assert kind == "mt5-html"
    assert rows[0]["normalized"]["external_id"] == "1001"
    assert rows[0]["status"] == "valid"
