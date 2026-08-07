"""Daily journal recaps — one entry per account per calendar day."""

from __future__ import annotations

import logging
import uuid
from datetime import date as date_type
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.db import get_db
from app.models.account import Account
from app.models.daily_recap import DailyRecap, DayMood
from app.models.trade import Trade, TradeStatus
from app.models.user import User
from app.schemas.daily_recap import (
    DailyRecapCreate,
    DailyRecapResponse,
    DailyRecapUpdate,
    DayPnlSummary,
)
from app.services.rate_limit import screenshot_upload_limiter
from app.services.storage import delete_local_upload, save_recap_screenshot

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/recaps", tags=["recaps"])


def _get_owned_account(db: Session, user: User, account_id: uuid.UUID) -> Account:
    account = db.get(Account, account_id)
    if not account or account.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return account


def _compute_day_pnl(
    db: Session,
    user_id: uuid.UUID,
    account_id: uuid.UUID,
    d: date_type,
) -> DayPnlSummary:
    start = datetime.combine(d, datetime.min.time()).replace(tzinfo=timezone.utc)
    end = datetime.combine(d, datetime.max.time()).replace(tzinfo=timezone.utc)
    trades = list(
        db.scalars(
            select(Trade).where(
                Trade.user_id == user_id,
                Trade.account_id == account_id,
                Trade.status == TradeStatus.closed,
                (
                    ((Trade.closed_at >= start) & (Trade.closed_at <= end))
                    | (
                        Trade.closed_at.is_(None)
                        & (Trade.opened_at >= start)
                        & (Trade.opened_at <= end)
                    )
                ),
            )
        ).all()
    )

    net = round(sum(float(t.pnl or 0) for t in trades), 2)
    fees = round(sum(float(t.fees or 0) for t in trades), 2)
    gross = round(net + fees, 2)
    return DayPnlSummary(
        date=d,
        trade_count=len(trades),
        gross_pnl=gross,
        fees=fees,
        net_pnl=net,
    )


def _to_float(value: Decimal | float | int | None) -> float | None:
    if value is None:
        return None
    return float(value)


def _resolve_pnl(
    recap: DailyRecap,
    computed: DayPnlSummary,
) -> tuple[float, float, float]:
    if recap.pnl_override:
        gross = float(recap.gross_pnl) if recap.gross_pnl is not None else computed.gross_pnl
        fees = float(recap.fees) if recap.fees is not None else computed.fees
        if recap.net_pnl is not None:
            net = float(recap.net_pnl)
        else:
            net = round(gross - fees, 2)
        return gross, fees, net
    return computed.gross_pnl, computed.fees, computed.net_pnl


def _to_response(
    recap: DailyRecap,
    computed: DayPnlSummary,
    recap_number: int,
) -> DailyRecapResponse:
    display_gross, display_fees, display_net = _resolve_pnl(recap, computed)
    return DailyRecapResponse(
        id=recap.id,
        account_id=recap.account_id,
        date=recap.date,
        day_mood=recap.day_mood.value if recap.day_mood else None,
        work_on=list(recap.work_on or []),
        best_decision=recap.best_decision,
        reflection=recap.reflection,
        pnl_override=bool(recap.pnl_override),
        gross_pnl=_to_float(recap.gross_pnl),
        fees=_to_float(recap.fees),
        net_pnl=_to_float(recap.net_pnl),
        screenshot_urls=list(recap.screenshot_urls or []),
        created_at=recap.created_at,
        updated_at=recap.updated_at,
        computed_gross_pnl=computed.gross_pnl,
        computed_fees=computed.fees,
        computed_net_pnl=computed.net_pnl,
        trade_count=computed.trade_count,
        display_gross_pnl=display_gross,
        display_fees=display_fees,
        display_net_pnl=display_net,
        recap_number=recap_number,
    )


def _recap_numbers(recaps: list[DailyRecap]) -> dict[uuid.UUID, int]:
    ordered = sorted(recaps, key=lambda r: (r.date, r.created_at))
    return {r.id: i + 1 for i, r in enumerate(ordered)}


def _apply_override_fields(
    recap: DailyRecap,
    *,
    pnl_override: bool,
    gross_pnl: Decimal | None,
    fees: Decimal | None,
    net_pnl: Decimal | None,
) -> None:
    recap.pnl_override = pnl_override
    if pnl_override:
        g = gross_pnl if gross_pnl is not None else Decimal("0")
        f = fees if fees is not None else Decimal("0")
        n = net_pnl if net_pnl is not None else (g - f)
        recap.gross_pnl = g
        recap.fees = f
        recap.net_pnl = n
    else:
        recap.gross_pnl = None
        recap.fees = None
        recap.net_pnl = None


@router.get("/day-pnl", response_model=DayPnlSummary)
def get_day_pnl(
    date: date_type = Query(...),
    account_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_owned_account(db, current_user, account_id)
    return _compute_day_pnl(db, current_user.id, account_id, date)


@router.get("", response_model=list[DailyRecapResponse])
def list_recaps(
    account_id: uuid.UUID = Query(...),
    limit: int = Query(90, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_owned_account(db, current_user, account_id)
    recaps = list(
        db.scalars(
            select(DailyRecap)
            .where(DailyRecap.user_id == current_user.id, DailyRecap.account_id == account_id)
            .order_by(DailyRecap.date.desc())
            .limit(limit)
        ).all()
    )
    numbers = _recap_numbers(recaps)
    # For numbering, load all dates chronologically for this account (lightweight)
    all_ids = list(
        db.scalars(
            select(DailyRecap)
            .where(DailyRecap.user_id == current_user.id, DailyRecap.account_id == account_id)
            .order_by(DailyRecap.date.asc(), DailyRecap.created_at.asc())
        ).all()
    )
    numbers = _recap_numbers(all_ids)

    result: list[DailyRecapResponse] = []
    for recap in recaps:
        computed = _compute_day_pnl(db, current_user.id, account_id, recap.date)
        result.append(_to_response(recap, computed, numbers.get(recap.id, 1)))
    return result


@router.get("/{recap_id}", response_model=DailyRecapResponse)
def get_recap(
    recap_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recap = db.get(DailyRecap, recap_id)
    if not recap or recap.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recap not found")

    all_ids = list(
        db.scalars(
            select(DailyRecap)
            .where(DailyRecap.user_id == current_user.id, DailyRecap.account_id == recap.account_id)
            .order_by(DailyRecap.date.asc(), DailyRecap.created_at.asc())
        ).all()
    )
    numbers = _recap_numbers(all_ids)
    computed = _compute_day_pnl(db, current_user.id, recap.account_id, recap.date)
    return _to_response(recap, computed, numbers.get(recap.id, 1))


@router.post("", response_model=DailyRecapResponse, status_code=status.HTTP_201_CREATED)
def upsert_recap(
    payload: DailyRecapCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_owned_account(db, current_user, payload.account_id)

    existing = db.scalar(
        select(DailyRecap).where(
            DailyRecap.user_id == current_user.id,
            DailyRecap.account_id == payload.account_id,
            DailyRecap.date == payload.date,
        )
    )

    mood = DayMood(payload.day_mood) if payload.day_mood else None

    if existing:
        existing.day_mood = mood
        existing.work_on = payload.work_on
        existing.best_decision = payload.best_decision
        existing.reflection = payload.reflection
        _apply_override_fields(
            existing,
            pnl_override=payload.pnl_override,
            gross_pnl=payload.gross_pnl,
            fees=payload.fees,
            net_pnl=payload.net_pnl,
        )
        db.commit()
        db.refresh(existing)
        recap = existing
        logger.info("Updated daily recap user=%s date=%s id=%s", current_user.id, payload.date, recap.id)
    else:
        recap = DailyRecap(
            user_id=current_user.id,
            account_id=payload.account_id,
            date=payload.date,
            day_mood=mood,
            work_on=payload.work_on,
            best_decision=payload.best_decision,
            reflection=payload.reflection,
        )
        _apply_override_fields(
            recap,
            pnl_override=payload.pnl_override,
            gross_pnl=payload.gross_pnl,
            fees=payload.fees,
            net_pnl=payload.net_pnl,
        )
        db.add(recap)
        db.commit()
        db.refresh(recap)
        logger.info("Created daily recap user=%s date=%s id=%s", current_user.id, payload.date, recap.id)

    all_ids = list(
        db.scalars(
            select(DailyRecap)
            .where(DailyRecap.user_id == current_user.id, DailyRecap.account_id == recap.account_id)
            .order_by(DailyRecap.date.asc(), DailyRecap.created_at.asc())
        ).all()
    )
    numbers = _recap_numbers(all_ids)
    computed = _compute_day_pnl(db, current_user.id, recap.account_id, recap.date)
    return _to_response(recap, computed, numbers.get(recap.id, 1))


@router.patch("/{recap_id}", response_model=DailyRecapResponse)
def update_recap(
    recap_id: uuid.UUID,
    payload: DailyRecapUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recap = db.get(DailyRecap, recap_id)
    if not recap or recap.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recap not found")

    if payload.clear_day_mood:
        recap.day_mood = None
    elif payload.day_mood is not None:
        recap.day_mood = DayMood(payload.day_mood)

    if payload.work_on is not None:
        recap.work_on = payload.work_on
    if "best_decision" in payload.model_fields_set:
        recap.best_decision = payload.best_decision
    if "reflection" in payload.model_fields_set:
        recap.reflection = payload.reflection

    if payload.pnl_override is not None or any(
        f in payload.model_fields_set for f in ("gross_pnl", "fees", "net_pnl")
    ):
        override = payload.pnl_override if payload.pnl_override is not None else recap.pnl_override
        _apply_override_fields(
            recap,
            pnl_override=override,
            gross_pnl=payload.gross_pnl if "gross_pnl" in payload.model_fields_set else recap.gross_pnl,
            fees=payload.fees if "fees" in payload.model_fields_set else recap.fees,
            net_pnl=payload.net_pnl if "net_pnl" in payload.model_fields_set else recap.net_pnl,
        )

    db.commit()
    db.refresh(recap)

    all_ids = list(
        db.scalars(
            select(DailyRecap)
            .where(DailyRecap.user_id == current_user.id, DailyRecap.account_id == recap.account_id)
            .order_by(DailyRecap.date.asc(), DailyRecap.created_at.asc())
        ).all()
    )
    numbers = _recap_numbers(all_ids)
    computed = _compute_day_pnl(db, current_user.id, recap.account_id, recap.date)
    return _to_response(recap, computed, numbers.get(recap.id, 1))


@router.delete("/{recap_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recap(
    recap_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recap = db.get(DailyRecap, recap_id)
    if not recap or recap.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recap not found")

    for url in list(recap.screenshot_urls or []):
        delete_local_upload(url)

    db.delete(recap)
    db.commit()
    logger.info("Deleted daily recap user=%s id=%s", current_user.id, recap_id)
    return None


@router.post("/{recap_id}/screenshots", response_model=DailyRecapResponse)
async def upload_screenshot(
    recap_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    screenshot_upload_limiter.check(str(current_user.id))

    recap = db.get(DailyRecap, recap_id)
    if not recap or recap.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recap not found")

    urls = list(recap.screenshot_urls or [])
    if len(urls) >= settings.max_recap_screenshots:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum {settings.max_recap_screenshots} screenshots allowed",
        )

    data = await file.read()
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")

    try:
        url = save_recap_screenshot(current_user.id, recap.id, data, file.content_type)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Screenshot save failed user=%s recap=%s", current_user.id, recap_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save screenshot",
        ) from None

    urls.append(url)
    recap.screenshot_urls = urls
    db.commit()
    db.refresh(recap)

    all_ids = list(
        db.scalars(
            select(DailyRecap)
            .where(DailyRecap.user_id == current_user.id, DailyRecap.account_id == recap.account_id)
            .order_by(DailyRecap.date.asc(), DailyRecap.created_at.asc())
        ).all()
    )
    numbers = _recap_numbers(all_ids)
    computed = _compute_day_pnl(db, current_user.id, recap.account_id, recap.date)
    logger.info("Uploaded recap screenshot user=%s recap=%s url=%s", current_user.id, recap_id, url)
    return _to_response(recap, computed, numbers.get(recap.id, 1))


@router.delete("/{recap_id}/screenshots", response_model=DailyRecapResponse)
def delete_screenshot(
    recap_id: uuid.UUID,
    url: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recap = db.get(DailyRecap, recap_id)
    if not recap or recap.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recap not found")

    urls = list(recap.screenshot_urls or [])
    if url not in urls:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Screenshot not found")

    urls = [u for u in urls if u != url]
    recap.screenshot_urls = urls
    db.commit()
    db.refresh(recap)
    delete_local_upload(url)

    all_ids = list(
        db.scalars(
            select(DailyRecap)
            .where(DailyRecap.user_id == current_user.id, DailyRecap.account_id == recap.account_id)
            .order_by(DailyRecap.date.asc(), DailyRecap.created_at.asc())
        ).all()
    )
    numbers = _recap_numbers(all_ids)
    computed = _compute_day_pnl(db, current_user.id, recap.account_id, recap.date)
    return _to_response(recap, computed, numbers.get(recap.id, 1))
