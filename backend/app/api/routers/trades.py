"""Trade CRUD + screenshots + voice attachments."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.api.routers.accounts import get_default_account
from app.core.config import settings
from app.core.db import get_db
from app.models.account import Account
from app.models.trade import Trade, TradeStatus
from app.models.user import User
from app.schemas.trade import TradeCreate, TradeExecutionResponse, TradeResponse, TradeUpdate
from app.services.behavior import apply_behavior_flags
from app.services.rate_limit import screenshot_upload_limiter
from app.services.storage import delete_local_upload, save_trade_screenshot, save_trade_voice
from app.services.trade_scores import execution_score, health_score, r_multiple
from app.services.trade_service import apply_calc, apply_journal_fields, compute_for_payload, remember_trade_masters, replace_executions
from app.services.ws_hub import hub

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/trades", tags=["trades"])


def _default_account(db: Session, user: User) -> Account:
    return get_default_account(db, user)


def _num(value) -> float | None:
    if value is None:
        return None
    return float(value)


def _to_response(trade: Trade) -> TradeResponse:
    extra = dict(trade.extra or {})
    remaining = extra.get("remaining_quantity")
    if remaining is None and trade.sell_quantity is not None:
        remaining = max(0.0, float(trade.quantity) - float(trade.sell_quantity))
    is_profit = extra.get("is_profit")
    if is_profit is None and trade.pnl is not None:
        is_profit = float(trade.pnl) > 0
    account_name = trade.account.name if trade.account is not None else None
    executions = [
        TradeExecutionResponse(
            id=row.id,
            leg_type=row.leg_type,
            quantity=float(row.quantity),
            price=float(row.price),
            executed_at=row.executed_at,
            fees=float(row.fees or 0),
            condition=row.condition,
            notes=row.notes,
            sort_order=row.sort_order,
        )
        for row in list(trade.executions or [])
    ]
    return TradeResponse(
        id=trade.id,
        account_id=trade.account_id,
        account_name=account_name,
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
        session=trade.session,
        trade_type=trade.trade_type,
        option_type=trade.option_type,
        analysis_timeframe=trade.analysis_timeframe,
        entry_timeframe=trade.entry_timeframe,
        stop_loss=_num(trade.stop_loss),
        invested_amount=_num(trade.invested_amount),
        entry_condition=trade.entry_condition,
        exit_condition=trade.exit_condition,
        sell_quantity=_num(trade.sell_quantity),
        total_sell_amount=_num(trade.total_sell_amount),
        leverage=_num(trade.leverage),
        contract_size=_num(trade.contract_size),
        is_favourite=bool(trade.is_favourite),
        is_deleted=bool(trade.is_deleted),
        is_sync=bool(trade.is_sync),
        is_close=bool(trade.is_close),
        is_equity=bool(trade.is_equity),
        is_profit=is_profit,
        year=trade.year,
        month=trade.month,
        strategy_name=trade.strategy_name or trade.setup_tag,
        strategy_id=trade.strategy_id,
        precheck_list_id=trade.precheck_list_id,
        extra=extra,
        remaining_quantity=float(remaining) if remaining is not None else None,
        executions=executions,
    )


def _sync_setup_tag(trade: Trade) -> None:
    tags = list(trade.setup_tags or [])
    if trade.setup_tag and trade.setup_tag not in tags:
        tags = [trade.setup_tag, *tags]
    trade.setup_tags = tags
    trade.setup_tag = tags[0] if tags else trade.setup_tag


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
    stmt = (
        select(Trade)
        .options(selectinload(Trade.executions), selectinload(Trade.account))
        .where(Trade.user_id == current_user.id, Trade.is_deleted.is_(False))
    )
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
    if payload.strategy_name and payload.strategy_name not in setup_tags:
        setup_tags.insert(0, payload.strategy_name)

    default_lev = float(current_user.default_forex_leverage) if current_user.default_forex_leverage else None
    calc = compute_for_payload(
        asset_type=payload.asset_type,
        symbol=payload.symbol.upper(),
        side=payload.side,
        opened_at=payload.opened_at,
        payload=payload,
        default_leverage=default_lev,
        default_fees=fees,
    )
    if calc.quantity <= 0 or calc.entry_price <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quantity and entry price are required")
    if calc.sell_quantity - calc.quantity > 1e-8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Exit quantity cannot exceed entry quantity")

    extra = dict(payload.extra or {})

    trade = Trade(
        user_id=current_user.id,
        account_id=account.id,
        symbol=payload.symbol.upper(),
        asset_type=payload.asset_type,
        side=payload.side,
        quantity=calc.quantity,
        entry_price=calc.entry_price,
        exit_price=calc.exit_price,
        opened_at=payload.opened_at,
        closed_at=payload.closed_at,
        fees=calc.fees,
        risk_amount=calc.risk_amount,
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
        status=calc.status,
        extra=extra,
        session=payload.session,
        trade_type=payload.trade_type,
        option_type=payload.option_type,
        analysis_timeframe=payload.analysis_timeframe,
        entry_timeframe=payload.entry_timeframe,
        stop_loss=payload.stop_loss,
        entry_condition=payload.entry_condition,
        exit_condition=payload.exit_condition,
        leverage=payload.leverage if payload.leverage is not None else default_lev,
        contract_size=payload.contract_size,
        is_favourite=bool(payload.is_favourite),
        strategy_name=payload.strategy_name or (setup_tags[0] if setup_tags else None),
        strategy_id=payload.strategy_id,
        precheck_list_id=payload.precheck_list_id,
    )
    apply_journal_fields(
        trade,
        {"precheck_list_id": payload.precheck_list_id, "extra": extra},
        db,
        current_user,
    )
    apply_calc(trade, calc)
    replace_executions(trade, calc.fills, payload.opened_at)
    _sync_setup_tag(trade)
    db.add(trade)
    db.flush()
    remember_trade_masters(db, current_user.id, trade)
    apply_behavior_flags(db, current_user.id, trade)
    db.commit()
    db.refresh(trade)
    _notify(current_user.id, account.id, "trade_created")
    return _to_response(trade)


@router.get("/{trade_id}", response_model=TradeResponse)
def get_trade(trade_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    trade = db.get(Trade, trade_id)
    if not trade or trade.user_id != current_user.id or trade.is_deleted:
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
    if not trade or trade.user_id != current_user.id or trade.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")

    update_data = payload.model_dump(exclude_unset=True)
    executions = update_data.pop("executions", None)
    journal = {k: update_data.pop(k) for k in list(update_data.keys()) if k in (
        "session", "trade_type", "option_type", "analysis_timeframe", "entry_timeframe",
        "stop_loss", "entry_condition", "exit_condition", "leverage", "contract_size",
        "is_favourite", "mood", "strategy_name", "strategy_id", "precheck_list_id", "extra",
        "sell_quantity",
    )}

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

    apply_journal_fields(trade, journal, db, current_user)
    if trade.strategy_name:
        tags = list(trade.setup_tags or [])
        if trade.strategy_name not in tags:
            tags.insert(0, trade.strategy_name)
            trade.setup_tags = tags
        trade.setup_tag = trade.strategy_name

    default_lev = float(current_user.default_forex_leverage) if current_user.default_forex_leverage else None
    calc_payload = payload
    if executions is not None:
        calc_payload.executions = payload.executions
    calc = compute_for_payload(
        asset_type=trade.asset_type,
        symbol=trade.symbol,
        side=trade.side,
        opened_at=trade.opened_at,
        payload=calc_payload,
        existing=trade,
        default_leverage=default_lev,
        default_fees=float(trade.fees or 0),
    )
    if calc.sell_quantity - calc.quantity > 1e-8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Exit quantity cannot exceed entry quantity")
    apply_calc(trade, calc)
    if executions is not None:
        replace_executions(trade, calc.fills, trade.opened_at)
    remember_trade_masters(db, current_user.id, trade)
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
