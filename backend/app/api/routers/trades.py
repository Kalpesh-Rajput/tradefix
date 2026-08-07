"""Trade CRUD + screenshots + voice attachments."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.routers.accounts import get_default_account
from app.core.config import settings
from app.core.db import get_db
from app.models.account import Account
from app.models.trade import Trade, TradeStatus
from app.models.user import User
from app.schemas.trade import TradeCreate, TradeResponse, TradeUpdate
from app.services.behavior import apply_behavior_flags
from app.services.rate_limit import screenshot_upload_limiter
from app.services.storage import delete_local_upload, save_trade_screenshot, save_trade_voice
from app.services.trade_scores import execution_score, health_score, r_multiple
from app.services.ws_hub import hub

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/trades", tags=["trades"])


def _default_account(db: Session, user: User) -> Account:
    return get_default_account(db, user)


def _compute_pnl(trade: Trade) -> None:
    if trade.exit_price is None or trade.status != TradeStatus.closed:
        trade.pnl = None
        return
    direction = 1 if trade.side.value == "long" else -1
    gross = (float(trade.exit_price) - float(trade.entry_price)) * float(trade.quantity) * direction
    trade.pnl = round(gross - float(trade.fees or 0), 2)


def _sync_setup_tag(trade: Trade) -> None:
    tags = list(trade.setup_tags or [])
    if trade.setup_tag and trade.setup_tag not in tags:
        tags = [trade.setup_tag, *tags]
    trade.setup_tags = tags
    trade.setup_tag = tags[0] if tags else trade.setup_tag


def _to_response(trade: Trade) -> TradeResponse:
    return TradeResponse(
        id=trade.id,
        account_id=trade.account_id,
        symbol=trade.symbol,
        asset_type=trade.asset_type,
        side=trade.side,
        quantity=float(trade.quantity),
        entry_price=float(trade.entry_price),
        exit_price=float(trade.exit_price) if trade.exit_price is not None else None,
        opened_at=trade.opened_at,
        closed_at=trade.closed_at,
        pnl=float(trade.pnl) if trade.pnl is not None else None,
        fees=float(trade.fees or 0),
        risk_amount=float(trade.risk_amount) if trade.risk_amount is not None else None,
        setup_tag=trade.setup_tag,
        setup_tags=list(trade.setup_tags or []),
        emotion_tags=list(trade.emotion_tags or []),
        plan_compliance=trade.plan_compliance,
        mood=trade.mood,
        notes=trade.notes,
        rules_broken=list(trade.rules_broken or []),
        screenshot_urls=list(trade.screenshot_urls or []),
        voice_url=trade.voice_url,
        voice_transcript=trade.voice_transcript,
        score_preparation=trade.score_preparation,
        score_risk=trade.score_risk,
        score_entry=trade.score_entry,
        score_exit=trade.score_exit,
        score_discipline=trade.score_discipline,
        score_psychology=trade.score_psychology,
        auto_flags=list(trade.auto_flags or []),
        status=trade.status,
        created_at=trade.created_at,
        execution_score=execution_score(trade),
        health_score=health_score(trade),
        r_multiple=r_multiple(trade),
    )


def _notify(user_id: uuid.UUID, account_id: uuid.UUID, event: str) -> None:
    try:
        hub.publish_sync(
            str(user_id),
            {"type": event, "account_id": str(account_id)},
        )
    except Exception:
        logger.debug("WS publish skipped", exc_info=True)


@router.get("", response_model=list[TradeResponse])
def list_trades(
    symbol: str | None = None,
    setup_tag: str | None = None,
    emotion_tag: str | None = None,
    status_filter: TradeStatus | None = Query(default=None, alias="status"),
    account_id: uuid.UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    limit: int = Query(default=200, le=1000),
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Trade).where(Trade.user_id == current_user.id)
    if account_id:
        account = db.get(Account, account_id)
        if not account or account.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
        stmt = stmt.where(Trade.account_id == account_id)
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

    trades = list(db.scalars(stmt).all())
    if emotion_tag:
        trades = [t for t in trades if emotion_tag in (t.emotion_tags or [])]
    return [_to_response(t) for t in trades]


@router.post("", response_model=TradeResponse, status_code=status.HTTP_201_CREATED)
def create_trade(
    payload: TradeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = db.get(Account, payload.account_id) if payload.account_id else _default_account(db, current_user)
    if not account or account.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid account")

    fees = (
        float(payload.fees)
        if payload.fees is not None
        else abs(float(account.default_fee_per_trade or 0))
    )

    setup_tags = list(payload.setup_tags or [])
    if payload.setup_tag and payload.setup_tag not in setup_tags:
        setup_tags.insert(0, payload.setup_tag)

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
        fees=fees,
        risk_amount=payload.risk_amount,
        setup_tag=setup_tags[0] if setup_tags else payload.setup_tag,
        setup_tags=setup_tags,
        emotion_tags=payload.emotion_tags,
        plan_compliance=payload.plan_compliance,
        mood=payload.mood,
        notes=payload.notes,
        rules_broken=payload.rules_broken,
        score_preparation=payload.score_preparation,
        score_risk=payload.score_risk,
        score_entry=payload.score_entry,
        score_exit=payload.score_exit,
        score_discipline=payload.score_discipline,
        score_psychology=payload.score_psychology,
        status=payload.status,
    )
    _compute_pnl(trade)
    _sync_setup_tag(trade)
    db.add(trade)
    db.flush()
    apply_behavior_flags(db, current_user.id, trade)
    db.commit()
    db.refresh(trade)
    _notify(current_user.id, account.id, "trade_created")
    return _to_response(trade)


@router.get("/{trade_id}", response_model=TradeResponse)
def get_trade(trade_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    trade = db.get(Trade, trade_id)
    if not trade or trade.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")
    return _to_response(trade)


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

    if "setup_tags" in update_data:
        tags = list(trade.setup_tags or [])
        trade.setup_tag = tags[0] if tags else None
    elif "setup_tag" in update_data and trade.setup_tag:
        tags = list(trade.setup_tags or [])
        if trade.setup_tag not in tags:
            tags.insert(0, trade.setup_tag)
            trade.setup_tags = tags

    _compute_pnl(trade)
    apply_behavior_flags(db, current_user.id, trade)
    db.commit()
    db.refresh(trade)
    _notify(current_user.id, trade.account_id, "trade_updated")
    return _to_response(trade)


@router.delete("/{trade_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trade(trade_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    trade = db.get(Trade, trade_id)
    if not trade or trade.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")
    account_id = trade.account_id
    for url in list(trade.screenshot_urls or []):
        delete_local_upload(url)
    delete_local_upload(trade.voice_url)
    db.delete(trade)
    db.commit()
    _notify(current_user.id, account_id, "trade_deleted")
    return None


@router.post("/{trade_id}/screenshots", response_model=TradeResponse)
async def upload_trade_screenshot(
    trade_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    screenshot_upload_limiter.check(str(current_user.id))
    trade = db.get(Trade, trade_id)
    if not trade or trade.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")

    urls = list(trade.screenshot_urls or [])
    if len(urls) >= settings.max_recap_screenshots:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum {settings.max_recap_screenshots} screenshots allowed",
        )

    data = await file.read()
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")

    url = save_trade_screenshot(current_user.id, trade.id, data, file.content_type)
    urls.append(url)
    trade.screenshot_urls = urls
    db.commit()
    db.refresh(trade)
    logger.info("Trade screenshot uploaded user=%s trade=%s", current_user.id, trade_id)
    return _to_response(trade)


@router.delete("/{trade_id}/screenshots", response_model=TradeResponse)
def delete_trade_screenshot(
    trade_id: uuid.UUID,
    url: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trade = db.get(Trade, trade_id)
    if not trade or trade.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")
    urls = list(trade.screenshot_urls or [])
    if url not in urls:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Screenshot not found")
    trade.screenshot_urls = [u for u in urls if u != url]
    db.commit()
    db.refresh(trade)
    delete_local_upload(url)
    return _to_response(trade)


@router.post("/{trade_id}/voice", response_model=TradeResponse)
async def upload_trade_voice(
    trade_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    screenshot_upload_limiter.check(str(current_user.id))
    trade = db.get(Trade, trade_id)
    if not trade or trade.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")

    data = await file.read()
    name = file.filename or "memo.webm"
    ext = "." + name.rsplit(".", 1)[-1] if "." in name else ".webm"
    previous = trade.voice_url
    trade.voice_url = save_trade_voice(current_user.id, trade.id, data, ext)
    db.commit()
    db.refresh(trade)
    delete_local_upload(previous)
    return _to_response(trade)
