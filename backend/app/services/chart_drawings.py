"""Chart drawing persistence. Every query is scoped to the authenticated user."""

from __future__ import annotations

import logging
import uuid

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models.backtest import BacktestSession
from app.models.chart_drawing import ChartDrawing
from app.models.user import User
from app.schemas.chart_drawing import MAX_PER_WORKSPACE, DrawingIn, SyncIn, SyncOut
from app.services.backtest.errors import BacktestError, not_found

log = logging.getLogger(__name__)


def _check_session(db: Session, user: User, session_id: uuid.UUID | None) -> None:
    if session_id is None:
        return
    row = db.get(BacktestSession, session_id)
    if row is None or row.user_id != user.id:
        raise not_found("Session")


def list_drawings(db: Session, user: User, workspace: str, symbol: str) -> list[ChartDrawing]:
    stmt = (
        select(ChartDrawing)
        .where(ChartDrawing.user_id == user.id, ChartDrawing.workspace == workspace, ChartDrawing.symbol == symbol)
        .order_by(ChartDrawing.z_order, ChartDrawing.created_at)
    )
    return list(db.scalars(stmt))


def _apply(row: ChartDrawing, item: DrawingIn) -> None:
    row.tool = item.tool
    row.symbol = item.symbol
    row.source = item.source
    row.timeframe = item.timeframe
    row.anchors = [anchor.model_dump() for anchor in item.anchors]
    row.style = item.style
    row.props = item.props
    row.visible = item.visible
    row.locked = item.locked
    row.z_order = item.z_order
    row.schema_version = item.schema_version


def sync(db: Session, user: User, payload: SyncIn) -> SyncOut:
    """Idempotent batch write: retrying the same payload yields the same state."""
    _check_session(db, user, payload.session_id)
    existing = {
        row.id: row
        for row in db.scalars(
            select(ChartDrawing).where(
                ChartDrawing.id.in_([item.id for item in payload.upserts] + payload.deletes),
            )
        )
    }
    foreign = [row for row in existing.values() if row.user_id != user.id or row.workspace != payload.workspace]
    if foreign:
        raise not_found("Drawing")
    new_rows = [item for item in payload.upserts if item.id not in existing]
    if new_rows:
        count = db.scalar(
            select(func.count()).select_from(ChartDrawing).where(ChartDrawing.user_id == user.id, ChartDrawing.workspace == payload.workspace)
        )
        if (count or 0) + len(new_rows) > MAX_PER_WORKSPACE:
            raise BacktestError("quota_exceeded", f"A chart can hold at most {MAX_PER_WORKSPACE} drawings.", status=409)
    for item in payload.upserts:
        row = existing.get(item.id)
        if row is None:
            row = ChartDrawing(id=item.id, user_id=user.id, workspace=payload.workspace, session_id=payload.session_id)
            db.add(row)
        _apply(row, item)
    removed = 0
    for drawing_id in payload.deletes:
        row = existing.get(drawing_id)
        if row is not None:
            db.delete(row)
            removed += 1
    db.commit()
    log.info("chart drawings synced user=%s workspace=%s saved=%d deleted=%d", user.id, payload.workspace, len(payload.upserts), removed)
    return SyncOut(saved=len(payload.upserts), deleted=removed)


def clear(db: Session, user: User, workspace: str, symbol: str) -> int:
    result = db.execute(
        delete(ChartDrawing).where(ChartDrawing.user_id == user.id, ChartDrawing.workspace == workspace, ChartDrawing.symbol == symbol)
    )
    db.commit()
    return result.rowcount or 0
