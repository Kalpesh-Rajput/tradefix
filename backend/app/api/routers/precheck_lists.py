"""Pre-trade checklists that can be assigned to a trade."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.precheck_list import PrecheckList
from app.models.user import User
from app.schemas.precheck import PrecheckListCreate, PrecheckListResponse, PrecheckListUpdate

router = APIRouter(prefix="/api/precheck-lists", tags=["precheck-lists"])

DEFAULT_CHECKLISTS = [
    {
        "name": "Pre-market",
        "items": [
            "Reviewed higher-timeframe bias",
            "Checked economic calendar",
            "Defined invalidation / stop",
            "Risk sized to plan",
        ],
    },
    {
        "name": "Before entry",
        "items": [
            "Setup matches playbook",
            "No revenge / FOMO",
            "Session conditions aligned",
            "Target and stop placed",
        ],
    },
]


def _seed_defaults(db: Session, user: User) -> None:
    existing = db.scalar(select(PrecheckList.id).where(PrecheckList.user_id == user.id).limit(1))
    if existing:
        return
    for spec in DEFAULT_CHECKLISTS:
        items = [{"id": str(uuid.uuid4()), "label": label} for label in spec["items"]]
        db.add(PrecheckList(user_id=user.id, name=spec["name"], items=items))
    db.flush()


@router.get("", response_model=list[PrecheckListResponse])
def list_precheck_lists(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _seed_defaults(db, current_user)
    db.commit()
    stmt = (
        select(PrecheckList)
        .where(PrecheckList.user_id == current_user.id)
        .order_by(PrecheckList.created_at.asc())
    )
    return list(db.scalars(stmt).all())


@router.post("", response_model=PrecheckListResponse, status_code=status.HTTP_201_CREATED)
def create_precheck_list(
    payload: PrecheckListCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = PrecheckList(user_id=current_user.id, name=payload.name, items=payload.items)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{list_id}", response_model=PrecheckListResponse)
def update_precheck_list(
    list_id: uuid.UUID,
    payload: PrecheckListUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.get(PrecheckList, list_id)
    if not row or row.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Checklist not found")
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_precheck_list(
    list_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.get(PrecheckList, list_id)
    if not row or row.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Checklist not found")
    db.delete(row)
    db.commit()
    return None
