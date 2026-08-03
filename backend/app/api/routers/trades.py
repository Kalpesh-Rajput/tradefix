import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.account import Account
from app.models.trade import Trade, TradeStatus
from app.models.user import User
from app.schemas.trade import TradeCreate, TradeResponse, TradeUpdate

router = APIRouter(prefix="/api/trades", tags=["trades"])


def _default_account(db: Session, user: User) -> Account:
    account = db.scalar(select(Account).where(Account.user_id == user.id))
    if not account:
        account = Account(user_id=user.id, name="Main Account")
        db.add(account)
        db.commit()
        db.refresh(account)
    return account


def _compute_pnl(trade: Trade) -> None:
    if trade.exit_price is None or trade.status != TradeStatus.closed:
        trade.pnl = None
        return
    direction = 1 if trade.side.value == "long" else -1
    gross = (float(trade.exit_price) - float(trade.entry_price)) * float(trade.quantity) * direction
    trade.pnl = round(gross - float(trade.fees or 0), 2)


@router.get("", response_model=list[TradeResponse])
def list_trades(
    symbol: str | None = None,
    setup_tag: str | None = None,
    status_filter: TradeStatus | None = Query(default=None, alias="status"),
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    limit: int = Query(default=200, le=1000),
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Trade).where(Trade.user_id == current_user.id)
    if symbol:
        stmt = stmt.where(Trade.symbol.ilike(f"%{symbol}%"))
    if setup_tag:
        stmt = stmt.where(Trade.setup_tag == setup_tag)
    if status_filter:
        stmt = stmt.where(Trade.status == status_filter)
    if date_from:
        stmt = stmt.where(Trade.opened_at >= date_from)
    if date_to:
        stmt = stmt.where(Trade.opened_at <= date_to)
    stmt = stmt.order_by(Trade.opened_at.desc()).limit(limit).offset(offset)

    trades = db.scalars(stmt).all()
    return trades


@router.post("", response_model=TradeResponse, status_code=status.HTTP_201_CREATED)
def create_trade(
    payload: TradeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = db.get(Account, payload.account_id) if payload.account_id else _default_account(db, current_user)
    if not account or account.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid account")

    trade = Trade(
        user_id=current_user.id,
        account_id=account.id,
        symbol=payload.symbol.upper(),
        asset_type=payload.asset_type,
        side=payload.side,
        quantity=payload.quantity,
        entry_price=payload.entry_price,
        exit_price=payload.exit_price,
        opened_at=payload.opened_at,
        closed_at=payload.closed_at,
        fees=payload.fees,
        setup_tag=payload.setup_tag,
        mood=payload.mood,
        notes=payload.notes,
        rules_broken=payload.rules_broken,
        status=payload.status,
    )
    _compute_pnl(trade)
    db.add(trade)
    db.commit()
    db.refresh(trade)
    return trade


@router.get("/{trade_id}", response_model=TradeResponse)
def get_trade(trade_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    trade = db.get(Trade, trade_id)
    if not trade or trade.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")
    return trade


@router.patch("/{trade_id}", response_model=TradeResponse)
def update_trade(
    trade_id: uuid.UUID,
    payload: TradeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trade = db.get(Trade, trade_id)
    if not trade or trade.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "symbol" and value:
            value = value.upper()
        setattr(trade, field, value)

    _compute_pnl(trade)
    db.commit()
    db.refresh(trade)
    return trade


@router.delete("/{trade_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trade(trade_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    trade = db.get(Trade, trade_id)
    if not trade or trade.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")
    db.delete(trade)
    db.commit()
    return None
