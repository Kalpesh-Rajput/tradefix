import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.schemas.replay import ReplayNoteIn, ReplayNoteOut, ReplayPayload
from app.services.backtest.entitlements import require_feature
from app.services.marketdata import replay_service

router = APIRouter(prefix="/api/trades", tags=["replay"])


@router.get("/{trade_id}/replay", response_model=ReplayPayload)
def get_trade_replay(
    trade_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("backtesting.replay")),
):
    return replay_service.journal_replay(db, current_user, trade_id)


@router.get("/{trade_id}/replay-notes", response_model=list[ReplayNoteOut])
def list_replay_notes(
    trade_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("backtesting.replay")),
):
    return replay_service.list_notes(db, current_user, trade_id)


@router.post("/{trade_id}/replay-notes", response_model=ReplayNoteOut, status_code=status.HTTP_201_CREATED)
def add_replay_note(
    trade_id: uuid.UUID,
    payload: ReplayNoteIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("backtesting.replay")),
):
    return replay_service.add_note(db, current_user, trade_id, payload)
