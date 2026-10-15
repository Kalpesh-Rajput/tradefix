import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.schemas.backtest import (
    JournalSaveIn,
    JournalSaveOut,
    OrderBatch,
    OrderOut,
    SessionCreate,
    SessionDetail,
    SessionStateIn,
    SessionSummary,
    TradeBatch,
    TradeOut,
)
from app.schemas.replay import ReplayPayload
from app.services.backtest import sessions_service
from app.services.backtest.entitlements import require_feature

router = APIRouter(prefix="/api/backtest/sessions", tags=["backtest-sessions"])


@router.post("", response_model=SessionDetail, status_code=status.HTTP_201_CREATED)
def create_session(payload: SessionCreate, db: Session = Depends(get_db), user: User = Depends(require_feature("backtesting.manual"))):
    return sessions_service.create_session(db, user, payload)


@router.get("", response_model=list[SessionSummary])
def list_sessions(db: Session = Depends(get_db), user: User = Depends(require_feature("backtesting.manual"))):
    return sessions_service.list_sessions(db, user)


@router.get("/{session_id}", response_model=SessionDetail)
def get_session(session_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(require_feature("backtesting.manual"))):
    return sessions_service.get_session(db, user, session_id)


@router.put("/{session_id}/state", response_model=SessionDetail)
def save_state(
    session_id: uuid.UUID,
    payload: SessionStateIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_feature("backtesting.manual")),
):
    return sessions_service.save_state(db, user, session_id, payload)


@router.post("/{session_id}/orders", response_model=list[OrderOut])
def save_orders(
    session_id: uuid.UUID,
    payload: OrderBatch,
    db: Session = Depends(get_db),
    user: User = Depends(require_feature("backtesting.manual")),
):
    return sessions_service.save_orders(db, user, session_id, payload)


@router.post("/{session_id}/trades", response_model=list[TradeOut])
def save_trades(
    session_id: uuid.UUID,
    payload: TradeBatch,
    db: Session = Depends(get_db),
    user: User = Depends(require_feature("backtesting.manual")),
):
    return sessions_service.save_trades(db, user, session_id, payload)


@router.post("/{session_id}/finish", response_model=SessionDetail)
def finish_session(session_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(require_feature("backtesting.manual"))):
    return sessions_service.finish_session(db, user, session_id)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(session_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(require_feature("backtesting.manual"))):
    sessions_service.delete_session(db, user, session_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{session_id}/trades/{trade_id}/replay", response_model=ReplayPayload)
def replay_trade(
    session_id: uuid.UUID,
    trade_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_feature("backtesting.manual")),
):
    return sessions_service.replay_for_trade(db, user, session_id, trade_id)


@router.post("/{session_id}/trades/{trade_id}/journal", response_model=JournalSaveOut, status_code=status.HTTP_201_CREATED)
def save_journal(
    session_id: uuid.UUID,
    trade_id: uuid.UUID,
    payload: JournalSaveIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_feature("backtesting.manual")),
):
    return sessions_service.save_to_journal(db, user, session_id, trade_id, payload.account_id)
