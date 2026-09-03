"""User-owned lookup values for Add Trade (symbols, conditions, timeframes, …)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.trade_master import MasterCategory, TradeMaster
from app.models.user import User
from app.schemas.masters import TradeMasterCreate, TradeMasterResponse, TradeMasterUpdate
from app.services.masters_service import list_masters, upsert_master

router = APIRouter(prefix="/api/masters", tags=["masters"])


@router.get("/categories", response_model=list[str])
def list_categories():
    return [c.value for c in MasterCategory]


@router.get("", response_model=list[TradeMasterResponse])
def get_masters(
    category: MasterCategory | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return list_masters(db, current_user.id, category)


@router.post("", response_model=TradeMasterResponse, status_code=status.HTTP_201_CREATED)
def create_master(
    payload: TradeMasterCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    name = payload.name.upper() if payload.category == MasterCategory.symbol else payload.name
    row = upsert_master(db, current_user.id, payload.category, name)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        row = upsert_master(db, current_user.id, payload.category, name)
        db.commit()
    db.refresh(row)
    return row


@router.patch("/{master_id}", response_model=TradeMasterResponse)
def update_master(
    master_id: uuid.UUID,
    payload: TradeMasterUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.get(TradeMaster, master_id)
    if not row or row.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Master not found")
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"]:
        name = data["name"].upper() if row.category == MasterCategory.symbol else data["name"]
        data["name"] = name
    for field, value in data.items():
        setattr(row, field, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A value with that name already exists")
    db.refresh(row)
    return row


@router.delete("/{master_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_master(
    master_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.get(TradeMaster, master_id)
    if not row or row.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Master not found")
    if row.is_builtin:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Built-in values cannot be deleted")
    db.delete(row)
    db.commit()
    return None
