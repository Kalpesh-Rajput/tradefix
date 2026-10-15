"""`/api/health` checks: database, market-data storage writable, market worker heartbeat."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select, text

from app.core.config import backend_path, settings
from app.models.job import WorkerHeartbeat


def _database() -> tuple[bool, datetime | None]:
    from app.core.db import SessionLocal

    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
            seen = db.scalar(select(WorkerHeartbeat.last_seen).where(WorkerHeartbeat.name == "market_worker"))
        return True, seen
    except Exception:
        return False, None


def _storage_writable() -> bool:
    root = backend_path(settings.market_data_dir) / "tmp"
    probe = root / f".health-{uuid.uuid4().hex}"
    try:
        root.mkdir(parents=True, exist_ok=True)
        probe.write_bytes(b"ok")
        probe.unlink()
        return True
    except OSError:
        return False


def health_report() -> dict:
    db_ok, last_seen = _database()
    age = None
    if last_seen is not None:
        age = (datetime.now(timezone.utc) - last_seen).total_seconds()
    if last_seen is None:
        worker = "missing"
    elif age <= settings.worker_heartbeat_stale_seconds:
        worker = "ok"
    else:
        worker = "stale"
    storage = _storage_writable()
    checks = {
        "database": "ok" if db_ok else "error",
        "storage": "ok" if storage else "error",
        "market_worker": worker,
        "market_worker_age_s": None if age is None else round(age, 1),
    }
    status = "ok" if db_ok and storage and worker == "ok" else "degraded"
    return {"status": status, "app": settings.app_name, "checks": checks}


def worker_status(db, *, admin: bool) -> dict:
    """Heartbeat age for the preparing-data notice. Admins also get the start command."""
    last_seen = db.scalar(select(WorkerHeartbeat.last_seen).where(WorkerHeartbeat.name == "market_worker"))
    age = None if last_seen is None else (datetime.now(timezone.utc) - last_seen).total_seconds()
    stale = last_seen is None or age > settings.worker_heartbeat_stale_seconds
    body = {
        "stale": stale,
        "slow_after_s": settings.data_wait_notice_s,
        "message": "The background worker appears offline." if stale else None,
    }
    if admin:
        body["heartbeat_age_s"] = None if age is None else round(age, 1)
        body["command"] = "python scripts/dev.py"
    return body
