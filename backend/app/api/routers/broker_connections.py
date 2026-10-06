import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.db import get_db
from app.models.broker import SyncRun
from app.models.user import User
from app.services.brokers.connections import (
    create_connection,
    delete_synced_data,
    disconnect,
    owned_connection,
    public_connection,
    status_payload,
)
from app.services.brokers.errors import BrokerError
from app.services.rate_limit import broker_connect_limiter
from app.services.sync.engine import enqueue, revalidate_connection

router = APIRouter(prefix="/api/broker-connections", tags=["broker-connections"])


def _raise(exc: BrokerError) -> None:
    raise HTTPException(status_code=exc.http_status, detail=exc.as_dict())


@router.get("")
def list_connections(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.models.broker import BrokerConnection

    rows = db.scalars(
        select(BrokerConnection).where(BrokerConnection.user_id == current_user.id).order_by(BrokerConnection.created_at.desc())
    ).all()
    return {"connections": [public_connection(db, row) for row in rows], "egress_ip": settings.broker_egress_ip or None}


@router.post("")
def connect(body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    broker_connect_limiter.check(str(current_user.id))
    try:
        connection, run = create_connection(db, current_user, body)
    except BrokerError as exc:
        _raise(exc)
    return JSONResponse(
        status_code=202,
        content={"connection": public_connection(db, connection), "sync_run_id": str(run.id)},
    )


@router.post("/{connection_id}/validate")
def validate(connection_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    broker_connect_limiter.check(str(current_user.id))
    try:
        connection = owned_connection(db, current_user.id, connection_id)
        revalidate_connection(db, connection)
    except BrokerError as exc:
        _raise(exc)
    return public_connection(db, connection)


@router.get("/{connection_id}")
def get_connection(connection_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        connection = owned_connection(db, current_user.id, connection_id)
    except BrokerError as exc:
        _raise(exc)
    return public_connection(db, connection)


@router.post("/{connection_id}/sync")
def sync_now(connection_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    broker_connect_limiter.check(f"sync:{current_user.id}")
    try:
        connection = owned_connection(db, current_user.id, connection_id)
        run = enqueue(db, connection, "manual_sync")
    except BrokerError as exc:
        _raise(exc)
    return JSONResponse(status_code=202, content={"sync_run_id": str(run.id), "status": run.status})


@router.get("/{connection_id}/status")
def connection_status(connection_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        connection = owned_connection(db, current_user.id, connection_id)
    except BrokerError as exc:
        _raise(exc)
    return status_payload(db, connection)


@router.get("/{connection_id}/sync-history")
def sync_history(connection_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        owned_connection(db, current_user.id, connection_id)
    except BrokerError as exc:
        _raise(exc)
    rows = db.scalars(
        select(SyncRun)
        .where(SyncRun.connection_id == connection_id, SyncRun.user_id == current_user.id)
        .order_by(SyncRun.created_at.desc())
        .limit(50)
    ).all()
    from app.services.brokers.connections import _run_dict

    return {"runs": [_run_dict(row) for row in rows]}


@router.patch("/{connection_id}")
def patch_connection(
    connection_id: uuid.UUID,
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        connection = owned_connection(db, current_user.id, connection_id)
    except BrokerError as exc:
        _raise(exc)
    if "paused" in body:
        connection.paused = bool(body["paused"])
    if "sync_interval_minutes" in body:
        minutes = int(body["sync_interval_minutes"])
        if minutes < 5 or minutes > 24 * 60:
            raise HTTPException(status_code=400, detail={"code": "NOT_SUPPORTED", "message": "Interval must be between 5 and 1440 minutes."})
        connection.sync_interval_minutes = minutes
    db.commit()
    return public_connection(db, connection)


@router.post("/{connection_id}/disconnect")
def disconnect_connection(
    connection_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    try:
        connection = owned_connection(db, current_user.id, connection_id)
    except BrokerError as exc:
        _raise(exc)
    disconnect(db, connection)
    return {"status": "disconnected", "trades_kept": True}


@router.delete("/{connection_id}")
def delete_connection(connection_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        connection = owned_connection(db, current_user.id, connection_id)
    except BrokerError as exc:
        _raise(exc)
    disconnect(db, connection)
    return {"status": "disconnected", "trades_kept": True}


@router.delete("/{connection_id}/data")
def delete_data(connection_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        connection = owned_connection(db, current_user.id, connection_id)
    except BrokerError as exc:
        _raise(exc)
    deleted = delete_synced_data(db, connection)
    return {"deleted_trades": deleted}
