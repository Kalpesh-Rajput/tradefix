from __future__ import annotations

import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.account import Account
from app.models.prop_settings import PropSettings
from app.models.trade import Trade, TradeStatus
from app.models.user import User
from app.services.prop_engine import distance_to_breach

router = APIRouter(prefix="/api/prop", tags=["prop"])

PROFILES = {
    "ftmo": {"max_daily_loss_pct": 5, "max_overall_drawdown_pct": 10, "consistency_rule_pct": 30, "min_trading_days": 4},
    "fundednext": {"max_daily_loss_pct": 5, "max_overall_drawdown_pct": 10, "consistency_rule_pct": None, "min_trading_days": 5},
    "myforexfunds": {"max_daily_loss_pct": 5, "max_overall_drawdown_pct": 12, "consistency_rule_pct": None, "min_trading_days": 0},
    "custom": {"max_daily_loss_pct": 5, "max_overall_drawdown_pct": 10, "consistency_rule_pct": None, "min_trading_days": 0},
}


class PropSettingsUpdate(BaseModel):
    account_id: uuid.UUID
    profile: str = "custom"
    max_daily_loss_pct: Decimal | None = None
    max_overall_drawdown_pct: Decimal | None = None
    consistency_rule_pct: Decimal | None = None
    min_trading_days: int | None = None
    warn_threshold_pct: Decimal = Field(default=Decimal("80"))
    danger_threshold_pct: Decimal = Field(default=Decimal("90"))
    enabled: bool = False


class PropSettingsResponse(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    profile: str
    max_daily_loss_pct: float
    max_overall_drawdown_pct: float
    consistency_rule_pct: float | None
    min_trading_days: int | None
    warn_threshold_pct: float
    danger_threshold_pct: float
    enabled: bool

    class Config:
        from_attributes = True


@router.get("/profiles")
def list_profiles():
    return [{"id": k, **v} for k, v in PROFILES.items()]


@router.get("/settings", response_model=PropSettingsResponse | None)
def get_settings(
    account_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.scalar(
        select(PropSettings).where(
            PropSettings.user_id == current_user.id,
            PropSettings.account_id == account_id,
        )
    )
    return row


@router.put("/settings", response_model=PropSettingsResponse)
def upsert_settings(
    payload: PropSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = db.get(Account, payload.account_id)
    if not account or account.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    profile = payload.profile.lower()
    if profile not in PROFILES:
        raise HTTPException(status_code=400, detail="Unknown profile")

    defaults = PROFILES[profile]
    row = db.scalar(
        select(PropSettings).where(
            PropSettings.user_id == current_user.id,
            PropSettings.account_id == payload.account_id,
        )
    )
    values = {
        "profile": profile,
        "max_daily_loss_pct": payload.max_daily_loss_pct
        if payload.max_daily_loss_pct is not None
        else Decimal(str(defaults["max_daily_loss_pct"])),
        "max_overall_drawdown_pct": payload.max_overall_drawdown_pct
        if payload.max_overall_drawdown_pct is not None
        else Decimal(str(defaults["max_overall_drawdown_pct"])),
        "consistency_rule_pct": payload.consistency_rule_pct
        if payload.consistency_rule_pct is not None
        else (Decimal(str(defaults["consistency_rule_pct"])) if defaults["consistency_rule_pct"] is not None else None),
        "min_trading_days": payload.min_trading_days
        if payload.min_trading_days is not None
        else defaults["min_trading_days"],
        "warn_threshold_pct": payload.warn_threshold_pct,
        "danger_threshold_pct": payload.danger_threshold_pct,
        "enabled": payload.enabled,
    }
    if row:
        for k, v in values.items():
            setattr(row, k, v)
    else:
        row = PropSettings(user_id=current_user.id, account_id=payload.account_id, **values)
        db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/distance")
def get_distance(
    account_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = db.get(Account, account_id)
    if not account or account.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Account not found")
    settings = db.scalar(
        select(PropSettings).where(
            PropSettings.user_id == current_user.id,
            PropSettings.account_id == account_id,
        )
    )
    trades = list(
        db.scalars(
            select(Trade).where(
                Trade.user_id == current_user.id,
                Trade.account_id == account_id,
                Trade.status == TradeStatus.closed,
            )
        ).all()
    )
    return distance_to_breach(account, settings, trades)
