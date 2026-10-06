"""Postgres-backed sync queue. One active job per connection. Heartbeats recover crashed workers."""

from __future__ import annotations

import json
import logging
import random
import socket
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.broker import BrokerAccount, BrokerConnection, BrokerCredential, SyncCheckpoint, SyncEvent, SyncJob, SyncRun
from app.services.brokers.errors import BrokerError, message_for
from app.services.brokers.factory import connector_for
from app.services.brokers.vault import decrypt, encrypt
from app.services.ingestion.persist import persist_executions
from app.services.ws_hub import hub

logger = logging.getLogger("tradefix.sync")

ACTIVE = ("queued", "running")
SYNCABLE = ("synced", "connected", "degraded")
AUTH_FAILURES = {"INVALID_CREDENTIALS", "WITHDRAWAL_PERMISSION_ENABLED", "PERMISSION_DENIED", "TOKEN_EXPIRED"}
RETRYABLE = {"RATE_LIMITED", "API_UNAVAILABLE", "NETWORK_ERROR"}
WORKER_ID = f"{socket.gethostname()}-{uuid.uuid4().hex[:8]}"


def enqueue(db: Session, connection: BrokerConnection, kind: str) -> SyncRun:
    existing = db.scalar(
        select(SyncJob).where(SyncJob.connection_id == connection.id, SyncJob.status.in_(ACTIVE))
    )
    if existing is not None:
        run = db.scalar(select(SyncRun).where(SyncRun.job_id == existing.id))
        if run is not None:
            return run
    job = SyncJob(
        user_id=connection.user_id,
        connection_id=connection.id,
        kind=kind,
        status="queued",
        job_timeout_seconds=settings.sync_job_timeout_seconds,
    )
    db.add(job)
    db.flush()
    run = SyncRun(user_id=connection.user_id, connection_id=connection.id, job_id=job.id, kind=kind, status="queued")
    db.add(run)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.scalar(
            select(SyncJob).where(SyncJob.connection_id == connection.id, SyncJob.status.in_(ACTIVE))
        )
        run = db.scalar(select(SyncRun).where(SyncRun.job_id == existing.id)) if existing else None
        if run is None:
            raise
        return run
    db.refresh(run)
    return run


def process_available(db: Session, *, limit: int = 1) -> int:
    handled = 0
    skipped: set[uuid.UUID] = set()
    for _ in range(limit):
        job = _claim(db, skipped)
        if job is None:
            break
        _run_job(db, job)
        handled += 1
    recover_stale(db)
    return handled


def retry_delay_seconds(attempt: int) -> float:
    base = min(300, 2 ** max(attempt, 1))
    return base + random.random()


def encode_cursor(cursor: dict) -> str:
    return json.dumps(cursor, sort_keys=True, default=str)


def decode_cursor(raw: str | None) -> dict:
    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {"cursor": raw}
    return data if isinstance(data, dict) else {"cursor": raw}


def recover_stale(db: Session) -> int:
    now = datetime.now(timezone.utc)
    heartbeat_deadline = now - timedelta(seconds=settings.sync_heartbeat_seconds * 3)
    running = db.scalars(select(SyncJob).where(SyncJob.status == "running")).all()
    recovered = 0
    for job in running:
        timed_out = False
        if job.job_started_at is not None:
            elapsed = (now - job.job_started_at).total_seconds()
            timed_out = elapsed > job.job_timeout_seconds
        stale_heart = job.last_heartbeat_at is None or job.last_heartbeat_at < heartbeat_deadline
        if not (timed_out or stale_heart):
            continue
        job.status = "queued"
        job.worker_id = None
        job.error_code = "INTERRUPTED"
        job.attempt += 1
        run = db.scalar(select(SyncRun).where(SyncRun.job_id == job.id))
        if run is not None:
            run.status = "interrupted"
            _event(db, run, "interrupted", "done", "Worker heartbeat expired. The job will resume from its checkpoint.")
        recovered += 1
    if recovered:
        db.commit()
    return recovered


def _claim(db: Session, skipped: set[uuid.UUID]) -> SyncJob | None:
    now = datetime.now(timezone.utc)
    while True:
        stmt = (
            select(SyncJob)
            .where(SyncJob.status == "queued")
            .where((SyncJob.next_attempt_at.is_(None)) | (SyncJob.next_attempt_at <= now))
            .order_by(SyncJob.created_at)
            .with_for_update(skip_locked=True)
        )
        if skipped:
            stmt = stmt.where(SyncJob.connection_id.notin_(skipped))
        job = db.scalar(stmt)
        if job is None:
            return None
        locked = db.execute(text("SELECT pg_try_advisory_lock(:key)"), {"key": _lock_key(job.connection_id)}).scalar()
        if locked:
            break
        skipped.add(job.connection_id)
        db.rollback()
    job.status = "running"
    job.worker_id = WORKER_ID
    job.job_started_at = job.job_started_at or now
    job.last_heartbeat_at = now
    run = db.scalar(select(SyncRun).where(SyncRun.job_id == job.id))
    if run is not None and run.started_at is None:
        run.status = "running"
        run.started_at = now
    db.commit()
    return job


def _run_job(db: Session, job: SyncJob) -> None:
    run = db.scalar(select(SyncRun).where(SyncRun.job_id == job.id))
    connection = db.get(BrokerConnection, job.connection_id)
    try:
        if connection is None or connection.paused:
            _finish(db, job, run, "cancelled", None, "Sync is paused.")
            return
        if connection.status == "disconnected":
            _finish(db, job, run, "cancelled", None, "Connection is disconnected.")
            return
        cred = db.scalar(select(BrokerCredential).where(BrokerCredential.connection_id == connection.id))
        if cred is None:
            _finish(db, job, run, "failed", "INVALID_CREDENTIALS", message_for("INVALID_CREDENTIALS"))
            return
        secrets = decrypt(cred.key_id, cred.nonce, cred.ciphertext, connection.id)
        connection.status = "syncing"
        connection.last_sync_at = datetime.now(timezone.utc)
        if job.kind == "refresh_token":
            _refresh_token(db, connection, cred, secrets)
            connection.status = "synced"
            connection.last_error_code = None
            connection.last_error = None
            _event(db, run, "token_refreshed", "done", None)
            _finish(db, job, run, "succeeded", None, None)
            return
        account = db.scalar(
            select(BrokerAccount).where(
                BrokerAccount.connection_id == connection.id,
                BrokerAccount.user_id == connection.user_id,
                BrokerAccount.is_selected.is_(True),
            )
        )
        if account is None or account.account_id is None:
            connection.status = "error"
            connection.last_error_code = "ACCOUNT_NOT_FOUND"
            connection.last_error = message_for("ACCOUNT_NOT_FOUND")
            _finish(db, job, run, "failed", "ACCOUNT_NOT_FOUND", message_for("ACCOUNT_NOT_FOUND"))
            return
        _event(db, run, "authenticated", "done", None)
        connector = connector_for(connection.provider)
        end = connection.history_to or datetime.now(timezone.utc)
        start = connection.history_from or (end - timedelta(days=30))
        if job.kind in {"incremental_sync", "reconciliation", "manual_sync"} and connection.last_success_at:
            start = connection.last_success_at - timedelta(minutes=settings.sync_overlap_minutes)
        checkpoint = db.scalar(
            select(SyncCheckpoint).where(
                SyncCheckpoint.connection_id == connection.id,
                SyncCheckpoint.stream == job.kind,
            )
        )
        resume = decode_cursor(checkpoint.cursor) if checkpoint else None
        if resume is not None and checkpoint is not None and "window" not in resume:
            resume["window"] = checkpoint.page
        _event(db, run, "fetching", "active", None)

        def on_batch(rows, cursor):
            _heartbeat(db, job)
            if run is None:
                return
            counts = persist_executions(
                db,
                user_id=connection.user_id,
                broker_account_id=account.id,
                journal_account_id=account.account_id,
                provider=connection.provider,
                rows=rows,
                sync_run_id=run.id,
            )
            run.records_received += counts["received"]
            run.records_created += counts["created"]
            run.records_updated += counts["updated"]
            run.records_skipped += counts["skipped"]
            run.records_failed += counts["failed"]
            _save_checkpoint(db, connection, job.kind, cursor)
            db.commit()

        started = datetime.now(timezone.utc)
        connector.fetch_executions(secrets, start, end, on_batch, resume)
        connection.last_success_at = datetime.now(timezone.utc)
        connection.last_sync_at = connection.last_success_at
        connection.last_error_code = None
        connection.last_error = None
        connection.retry_count = 0
        connection.status = "synced"
        _clear_checkpoint(db, connection, job.kind)
        _event(db, run, "processing", "done", None)
        _log_job(connection, account, job, run, started)
        _finish(db, job, run, "succeeded", None, None)
    except BrokerError as exc:
        db.rollback()
        job = db.get(SyncJob, job.id)
        run = db.scalar(select(SyncRun).where(SyncRun.job_id == job.id)) if job else None
        connection = db.get(BrokerConnection, job.connection_id) if job else None
        safe_message = message_for(exc.code, exc.message)
        if connection is not None:
            connection.last_error_code = exc.code
            connection.last_error = safe_message
            connection.retry_count = (connection.retry_count or 0) + 1
            connection.status = "auth_expired" if exc.code in AUTH_FAILURES else "degraded"
        retry = exc.code in RETRYABLE
        if job is not None and retry and job.attempt < 5:
            job.status = "queued"
            job.attempt += 1
            job.next_attempt_at = datetime.now(timezone.utc) + timedelta(seconds=retry_delay_seconds(job.attempt))
            job.worker_id = None
            if run is not None:
                run.status = "retry_wait"
                run.error_code = exc.code
                run.error_message = safe_message
            db.commit()
        else:
            if connection is not None and exc.code not in AUTH_FAILURES:
                connection.status = "error"
            _finish(db, job, run, "failed", exc.code, safe_message)
    except Exception:
        db.rollback()
        job = db.get(SyncJob, job.id)
        run = db.scalar(select(SyncRun).where(SyncRun.job_id == job.id)) if job else None
        connection = db.get(BrokerConnection, job.connection_id) if job else None
        if connection is not None:
            connection.status = "error"
            connection.last_error_code = "UNKNOWN_ERROR"
            connection.last_error = message_for("UNKNOWN_ERROR")
        logger.exception(
            "sync failed connection_id=%s job_id=%s",
            getattr(job, "connection_id", None),
            getattr(job, "id", None),
        )
        _finish(db, job, run, "failed", "UNKNOWN_ERROR", message_for("UNKNOWN_ERROR"))
    finally:
        db.execute(text("SELECT pg_advisory_unlock(:key)"), {"key": _lock_key(job.connection_id)})
        db.commit()


def _finish(db, job, run, status, code, message) -> None:
    now = datetime.now(timezone.utc)
    if job is not None:
        job.status = "succeeded" if status == "succeeded" else ("cancelled" if status == "cancelled" else "failed")
        job.error_code = code
        job.last_heartbeat_at = now
    if run is not None:
        run.status = status
        run.finished_at = now
        run.error_code = code
        run.error_message = message
        _event(db, run, status, "done", message)
        hub.publish_sync(
            str(run.user_id),
            {"type": "sync_progress", "connection_id": str(run.connection_id), "sync_run_id": str(run.id), "status": status},
        )
    db.commit()


def _heartbeat(db, job: SyncJob) -> None:
    job.last_heartbeat_at = datetime.now(timezone.utc)
    db.flush()


def _event(db, run: SyncRun | None, step: str, state: str, detail: str | None) -> None:
    if run is None:
        return
    db.add(
        SyncEvent(
            user_id=run.user_id,
            connection_id=run.connection_id,
            sync_run_id=run.id,
            step=step,
            state=state,
            detail=detail,
        )
    )
    db.flush()


def _save_checkpoint(db, connection: BrokerConnection, stream: str, cursor: dict) -> None:
    encoded = encode_cursor(cursor)
    page = int(cursor.get("window") or cursor.get("page") or 0)
    row = db.scalar(
        select(SyncCheckpoint).where(SyncCheckpoint.connection_id == connection.id, SyncCheckpoint.stream == stream)
    )
    if row is None:
        db.add(
            SyncCheckpoint(
                user_id=connection.user_id,
                connection_id=connection.id,
                stream=stream,
                cursor=encoded,
                page=page,
            )
        )
    else:
        row.cursor = encoded
        row.page = page


def _clear_checkpoint(db, connection: BrokerConnection, stream: str) -> None:
    row = db.scalar(
        select(SyncCheckpoint).where(SyncCheckpoint.connection_id == connection.id, SyncCheckpoint.stream == stream)
    )
    if row is not None:
        db.delete(row)


def _refresh_token(db, connection: BrokerConnection, cred: BrokerCredential, secrets: dict) -> None:
    updated = connector_for(connection.provider).refresh_credentials(secrets)
    access = updated.get("accessToken") or updated.get("access_token")
    if not access:
        raise BrokerError("TOKEN_EXPIRED", message_for("TOKEN_EXPIRED"))
    secrets["access_token"] = str(access)
    refresh = updated.get("refreshToken") or updated.get("refresh_token")
    if refresh:
        secrets["refresh_token"] = str(refresh)
    expires = updated.get("expiresIn") or updated.get("expires_in")
    if expires:
        secrets["expires_in"] = str(expires)
        cred.token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=int(expires))
    key_id, nonce, ciphertext = encrypt(secrets, connection.id)
    cred.key_id = key_id
    cred.nonce = nonce
    cred.ciphertext = ciphertext
    cred.rotated_at = datetime.now(timezone.utc)


def revalidate_connection(db: Session, connection: BrokerConnection) -> None:
    cred = db.scalar(
        select(BrokerCredential).where(
            BrokerCredential.connection_id == connection.id,
            BrokerCredential.user_id == connection.user_id,
        )
    )
    if cred is None:
        connection.status = "auth_expired"
        connection.last_error_code = "INVALID_CREDENTIALS"
        connection.last_error = message_for("INVALID_CREDENTIALS")
        db.commit()
        raise BrokerError("INVALID_CREDENTIALS", message_for("INVALID_CREDENTIALS"))
    secrets = decrypt(cred.key_id, cred.nonce, cred.ciphertext, connection.id)
    try:
        connector_for(connection.provider).validate(secrets)
    except BrokerError as exc:
        connection.status = "auth_expired" if exc.code in AUTH_FAILURES else "degraded"
        connection.last_error_code = exc.code
        connection.last_error = message_for(exc.code, exc.message)
        db.commit()
        raise
    connection.last_error_code = None
    connection.last_error = None
    if connection.status in {"auth_expired", "needs_reauth", "error"}:
        connection.status = "synced" if connection.last_success_at else "syncing"
    db.commit()


def _log_job(connection, account, job, run, started: datetime) -> None:
    duration_ms = int((datetime.now(timezone.utc) - started).total_seconds() * 1000)
    logger.info(
        "sync finished connection_id=%s provider=%s account_id=%s job_id=%s duration_ms=%s received=%s created=%s updated=%s skipped=%s failed=%s",
        connection.id,
        connection.provider,
        account.id,
        job.id,
        duration_ms,
        getattr(run, "records_received", 0),
        getattr(run, "records_created", 0),
        getattr(run, "records_updated", 0),
        getattr(run, "records_skipped", 0),
        getattr(run, "records_failed", 0),
    )


def _lock_key(connection_id: uuid.UUID) -> int:
    return int.from_bytes(connection_id.bytes[:8], "big", signed=True)


def enqueue_due(db: Session) -> int:
    now = datetime.now(timezone.utc)
    rows = db.scalars(
        select(BrokerConnection).where(BrokerConnection.status.in_(SYNCABLE), BrokerConnection.paused.is_(False))
    ).all()
    queued = 0
    for connection in rows:
        interval = timedelta(minutes=connection.sync_interval_minutes or settings.sync_default_interval_minutes)
        if connection.last_success_at and now - connection.last_success_at < interval:
            continue
        enqueue(db, connection, "incremental_sync")
        queued += 1
    return queued


def enqueue_reconciliation(db: Session) -> int:
    now = datetime.now(timezone.utc)
    gap = timedelta(minutes=settings.sync_reconcile_minutes)
    rows = db.scalars(
        select(BrokerConnection).where(BrokerConnection.status.in_(SYNCABLE), BrokerConnection.paused.is_(False))
    ).all()
    queued = 0
    for connection in rows:
        active = db.scalar(select(SyncJob).where(SyncJob.connection_id == connection.id, SyncJob.status.in_(ACTIVE)))
        if active is not None:
            continue
        last = db.scalar(
            select(SyncRun)
            .where(SyncRun.connection_id == connection.id, SyncRun.kind == "reconciliation", SyncRun.status == "succeeded")
            .order_by(SyncRun.finished_at.desc())
        )
        if last is not None and last.finished_at is not None and now - last.finished_at < gap:
            continue
        enqueue(db, connection, "reconciliation")
        queued += 1
    return queued


def enqueue_token_refresh(db: Session) -> int:
    now = datetime.now(timezone.utc)
    horizon = now + timedelta(minutes=15)
    rows = db.scalars(
        select(BrokerConnection).where(
            BrokerConnection.provider == "ctrader",
            BrokerConnection.status.in_(SYNCABLE),
            BrokerConnection.paused.is_(False),
        )
    ).all()
    queued = 0
    for connection in rows:
        cred = db.scalar(select(BrokerCredential).where(BrokerCredential.connection_id == connection.id))
        if cred is None:
            continue
        due = cred.token_expires_at is None or cred.token_expires_at <= horizon
        if cred.token_expires_at is None:
            last = db.scalar(
                select(SyncRun)
                .where(SyncRun.connection_id == connection.id, SyncRun.kind == "refresh_token", SyncRun.status == "succeeded")
                .order_by(SyncRun.finished_at.desc())
            )
            due = last is None or last.finished_at is None or now - last.finished_at >= timedelta(hours=12)
        if not due:
            continue
        enqueue(db, connection, "refresh_token")
        queued += 1
    return queued
