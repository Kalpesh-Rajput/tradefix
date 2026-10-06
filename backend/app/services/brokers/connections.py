"""Create, pause, and disconnect broker connections. Secrets are encrypted before commit."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.broker import BrokerAccount, BrokerConnection, BrokerCredential, SyncEvent, SyncJob, SyncRun
from app.models.trade import Trade
from app.models.user import User
from app.services.brokers.errors import BrokerError, message_for
from app.services.brokers.factory import connector_for
from app.services.brokers.redact import mask_account_id
from app.services.brokers.registry import get_provider
from app.services.brokers.vault import decrypt, encrypt
from app.services.sync.engine import enqueue

_PRESETS = {"7d": 7, "30d": 30, "90d": 90, "180d": 180, "365d": 365}


def create_connection(db: Session, user: User, body: dict) -> tuple[BrokerConnection, SyncRun]:
    provider_id = str(body.get("provider") or "").lower()
    spec = get_provider(provider_id)
    if "broker_sync" not in spec.methods:
        raise BrokerError("NOT_SUPPORTED", f"{spec.display_name} does not support broker sync.")
    credentials = _credentials_from_body(spec, body)
    account_info = connector_for(provider_id).validate(credentials)
    if account_info.permissions.get("enableWithdrawals") or account_info.permissions.get("withdrawal"):
        raise BrokerError("WITHDRAWAL_PERMISSION_ENABLED", message_for("WITHDRAWAL_PERMISSION_ENABLED"))
    start, end = _range(body)
    connection = BrokerConnection(
        user_id=user.id,
        provider=provider_id,
        environment=str(body.get("environment") or credentials.get("environment") or "live"),
        region=credentials.get("region"),
        status="syncing",
        sync_interval_minutes=int(body.get("sync_interval_minutes") or 15),
        history_from=start,
        history_to=end,
        display_name=spec.display_name,
    )
    db.add(connection)
    db.flush()
    if account_info.raw.get("bridge_connection_id"):
        credentials["bridge_connection_id"] = account_info.raw["bridge_connection_id"]
    if body.get("external_account_id"):
        credentials["external_account_id"] = str(body["external_account_id"])
    key_id, nonce, ciphertext = encrypt(credentials, connection.id)
    credential = BrokerCredential(
        connection_id=connection.id,
        user_id=user.id,
        key_id=key_id,
        nonce=nonce,
        ciphertext=ciphertext,
        token_expires_at=_token_expiry(credentials),
    )
    db.add(credential)
    journal = Account(
        user_id=user.id,
        name=f"{spec.display_name} {mask_account_id(account_info.external_account_id)}",
        base_currency=(account_info.currency or "USD")[:10],
        source="broker",
        broker_id=provider_id,
        broker_name=spec.display_name,
        initial_balance=account_info.balance or 0,
    )
    db.add(journal)
    db.flush()
    db.add(
        BrokerAccount(
            user_id=user.id,
            connection_id=connection.id,
            account_id=journal.id,
            external_account_id=str(account_info.external_account_id),
            masked_id=mask_account_id(account_info.external_account_id),
            account_type=account_info.account_type,
            currency=account_info.currency or "USD",
            balance=account_info.balance,
            equity=account_info.equity,
            is_selected=True,
        )
    )
    db.commit()
    db.refresh(connection)
    run = enqueue(db, connection, "initial_sync")
    return connection, run


def public_connection(db: Session, connection: BrokerConnection) -> dict:
    account = db.scalar(
        select(BrokerAccount).where(
            BrokerAccount.connection_id == connection.id,
            BrokerAccount.user_id == connection.user_id,
        )
    )
    latest = db.scalar(
        select(SyncRun)
        .where(SyncRun.connection_id == connection.id, SyncRun.user_id == connection.user_id)
        .order_by(SyncRun.created_at.desc())
    )
    return {
        "id": str(connection.id),
        "provider": connection.provider,
        "display_name": connection.display_name,
        "status": connection.status,
        "paused": connection.paused,
        "environment": connection.environment,
        "region": connection.region,
        "sync_interval_minutes": connection.sync_interval_minutes,
        "realtime_status": connection.realtime_status,
        "last_success_at": _iso(connection.last_success_at),
        "last_error_code": connection.last_error_code,
        "last_error_message": message_for(connection.last_error_code) if connection.last_error_code else None,
        "history_from": _iso(connection.history_from),
        "history_to": _iso(connection.history_to),
        "account": None
        if account is None
        else {
            "id": str(account.id),
            "masked_id": account.masked_id,
            "account_type": account.account_type,
            "currency": account.currency,
            "balance": _num(account.balance),
            "equity": _num(account.equity),
            "journal_account_id": str(account.account_id) if account.account_id else None,
        },
        "latest_run": None if latest is None else _run_dict(latest),
    }


def status_payload(db: Session, connection: BrokerConnection) -> dict:
    run = db.scalar(
        select(SyncRun)
        .where(SyncRun.connection_id == connection.id, SyncRun.user_id == connection.user_id)
        .order_by(SyncRun.created_at.desc())
    )
    events = []
    if run is not None:
        rows = db.scalars(
            select(SyncEvent)
            .where(SyncEvent.sync_run_id == run.id, SyncEvent.user_id == connection.user_id)
            .order_by(SyncEvent.created_at)
        ).all()
        events = [{"step": row.step, "state": row.state, "detail": row.detail, "at": _iso(row.created_at)} for row in rows]
    return {"connection": public_connection(db, connection), "run": None if run is None else _run_dict(run), "events": events}


def disconnect(db: Session, connection: BrokerConnection) -> None:
    db.query(SyncJob).filter(
        SyncJob.connection_id == connection.id,
        SyncJob.status.in_(("queued", "running")),
    ).update({"status": "cancelled"}, synchronize_session=False)
    cred = db.scalar(select(BrokerCredential).where(BrokerCredential.connection_id == connection.id))
    if cred is not None:
        db.delete(cred)
    connection.status = "disconnected"
    connection.paused = True
    connection.realtime_status = "off"
    db.commit()


def delete_synced_data(db: Session, connection: BrokerConnection) -> int:
    accounts = db.scalars(
        select(BrokerAccount).where(
            BrokerAccount.connection_id == connection.id,
            BrokerAccount.user_id == connection.user_id,
        )
    ).all()
    deleted = 0
    db.execute(text("SELECT set_config('tradefix.allow_raw_delete', 'on', true)"))
    for account in accounts:
        result = db.query(Trade).filter(Trade.user_id == connection.user_id, Trade.broker_account_id == account.id).delete(
            synchronize_session=False
        )
        deleted += int(result or 0)
    db.commit()
    return deleted


def _credentials_from_body(spec, body: dict) -> dict:
    provided = body.get("credentials") if isinstance(body.get("credentials"), dict) else body
    credentials: dict[str, str] = {}
    for field in spec.fields:
        if field.key in {"history_preset", "timezone"}:
            continue
        value = provided.get(field.key)
        if field.required and (value is None or str(value).strip() == ""):
            raise BrokerError("INVALID_CREDENTIALS", f"{field.label} is required.")
        if value is not None and str(value).strip() != "":
            credentials[field.key] = str(value).strip() if not field.secret else str(value)
    for extra in ("access_token", "refresh_token", "external_account_id", "expires_in"):
        if provided.get(extra):
            credentials[extra] = str(provided[extra])
    return credentials


def _range(body: dict) -> tuple[datetime, datetime]:
    end = datetime.now(timezone.utc)
    preset = str(body.get("history_preset") or body.get("credentials", {}).get("history_preset") or "30d")
    if preset == "custom":
        start_raw = body.get("history_from")
        end_raw = body.get("history_to")
        if not start_raw or not end_raw:
            raise BrokerError("HISTORICAL_LIMIT", "Custom range needs history_from and history_to.")
        return _parse(start_raw), _parse(end_raw)
    days = _PRESETS.get(preset, 30)
    return end - timedelta(days=days), end


def _token_expiry(credentials: dict) -> datetime | None:
    raw = str(credentials.get("expires_in") or "").strip()
    if not raw.isdigit():
        return None
    return datetime.now(timezone.utc) + timedelta(seconds=int(raw))


def _parse(value: str) -> datetime:
    text_value = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(text_value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _run_dict(run: SyncRun) -> dict:
    duration = None
    if run.started_at and run.finished_at:
        duration = int((run.finished_at - run.started_at).total_seconds())
    return {
        "id": str(run.id),
        "kind": run.kind,
        "status": run.status,
        "started_at": _iso(run.started_at),
        "finished_at": _iso(run.finished_at),
        "duration_seconds": duration,
        "records_received": run.records_received,
        "records_created": run.records_created,
        "records_updated": run.records_updated,
        "records_skipped": run.records_skipped,
        "records_failed": run.records_failed,
        "error_code": run.error_code,
        "error_message": run.error_message,
    }


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _num(value) -> str | None:
    return None if value is None else format(value, "f")


def owned_connection(db: Session, user_id: uuid.UUID, connection_id: uuid.UUID) -> BrokerConnection:
    connection = db.get(BrokerConnection, connection_id)
    if connection is None or connection.user_id != user_id:
        raise BrokerError("ACCOUNT_NOT_FOUND", "Connection not found.", http_status=404)
    return connection


def load_secrets(db: Session, connection: BrokerConnection) -> dict:
    cred = db.scalar(
        select(BrokerCredential).where(
            BrokerCredential.connection_id == connection.id,
            BrokerCredential.user_id == connection.user_id,
        )
    )
    if cred is None:
        raise BrokerError("INVALID_CREDENTIALS", message_for("INVALID_CREDENTIALS"))
    return decrypt(cred.key_id, cred.nonce, cred.ciphertext, connection.id)
