"""Mentor mode + trade comments."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.mentor import MentorAccess, TradeComment
from app.models.trade import Trade
from app.models.user import User

router = APIRouter(prefix="/api/mentor", tags=["mentor"])


class InviteRequest(BaseModel):
    email: EmailStr


class MentorAccessResponse(BaseModel):
    id: uuid.UUID
    trader_id: uuid.UUID
    coach_id: uuid.UUID
    trader_email: str | None = None
    coach_email: str | None = None
    trader_name: str | None = None
    status: str

    class Config:
        from_attributes = True


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class CommentResponse(BaseModel):
    id: uuid.UUID
    trade_id: uuid.UUID
    author_id: uuid.UUID
    author_name: str | None = None
    body: str
    created_at: str

    class Config:
        from_attributes = True


@router.post("/invite", response_model=MentorAccessResponse)
def invite_coach(
    payload: InviteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    coach = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not coach:
        raise HTTPException(status_code=404, detail="No user with that email. They must sign up first.")
    if coach.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot invite yourself")

    existing = db.scalar(
        select(MentorAccess).where(
            MentorAccess.trader_id == current_user.id,
            MentorAccess.coach_id == coach.id,
        )
    )
    if existing:
        return MentorAccessResponse(
            id=existing.id,
            trader_id=existing.trader_id,
            coach_id=existing.coach_id,
            trader_email=current_user.email,
            coach_email=coach.email,
            trader_name=current_user.name,
            status=existing.status,
        )

    row = MentorAccess(trader_id=current_user.id, coach_id=coach.id, status="accepted")
    coach.role = "coach"
    db.add(row)
    db.commit()
    db.refresh(row)
    return MentorAccessResponse(
        id=row.id,
        trader_id=row.trader_id,
        coach_id=row.coach_id,
        trader_email=current_user.email,
        coach_email=coach.email,
        trader_name=current_user.name,
        status=row.status,
    )


@router.get("/students", response_model=list[MentorAccessResponse])
def list_students(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.scalars(
        select(MentorAccess).where(
            MentorAccess.coach_id == current_user.id,
            MentorAccess.status == "accepted",
        )
    ).all()
    out = []
    for r in rows:
        trader = db.get(User, r.trader_id)
        out.append(
            MentorAccessResponse(
                id=r.id,
                trader_id=r.trader_id,
                coach_id=r.coach_id,
                trader_email=trader.email if trader else None,
                coach_email=current_user.email,
                trader_name=trader.name if trader else None,
                status=r.status,
            )
        )
    return out


@router.get("/coaches", response_model=list[MentorAccessResponse])
def list_coaches(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.scalars(
        select(MentorAccess).where(
            MentorAccess.trader_id == current_user.id,
            MentorAccess.status == "accepted",
        )
    ).all()
    out = []
    for r in rows:
        coach = db.get(User, r.coach_id)
        out.append(
            MentorAccessResponse(
                id=r.id,
                trader_id=r.trader_id,
                coach_id=r.coach_id,
                trader_email=current_user.email,
                coach_email=coach.email if coach else None,
                trader_name=current_user.name,
                status=r.status,
            )
        )
    return out


def _can_access_trade(db: Session, user: User, trade: Trade) -> bool:
    if trade.user_id == user.id:
        return True
    access = db.scalar(
        select(MentorAccess).where(
            MentorAccess.trader_id == trade.user_id,
            MentorAccess.coach_id == user.id,
            MentorAccess.status == "accepted",
        )
    )
    return access is not None


@router.get("/trades/{trade_id}/comments", response_model=list[CommentResponse])
def list_comments(
    trade_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trade = db.get(Trade, trade_id)
    if not trade or not _can_access_trade(db, current_user, trade):
        raise HTTPException(status_code=404, detail="Trade not found")
    rows = db.scalars(
        select(TradeComment).where(TradeComment.trade_id == trade_id).order_by(TradeComment.created_at.asc())
    ).all()
    out = []
    for r in rows:
        author = db.get(User, r.author_id)
        out.append(
            CommentResponse(
                id=r.id,
                trade_id=r.trade_id,
                author_id=r.author_id,
                author_name=author.name if author else None,
                body=r.body,
                created_at=r.created_at.isoformat(),
            )
        )
    return out


@router.post("/trades/{trade_id}/comments", response_model=CommentResponse, status_code=201)
def add_comment(
    trade_id: uuid.UUID,
    payload: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trade = db.get(Trade, trade_id)
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    # Only coach can initiate comments
    access = db.scalar(
        select(MentorAccess).where(
            MentorAccess.trader_id == trade.user_id,
            MentorAccess.coach_id == current_user.id,
            MentorAccess.status == "accepted",
        )
    )
    if not access and trade.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")
    if not access and trade.user_id == current_user.id:
        # trader can reply if a coach comment already exists
        has_coach = db.scalar(
            select(TradeComment).where(
                TradeComment.trade_id == trade_id,
                TradeComment.author_id != current_user.id,
            )
        )
        if not has_coach:
            raise HTTPException(status_code=403, detail="Only your coach can start feedback")

    row = TradeComment(trade_id=trade_id, author_id=current_user.id, body=payload.body.strip())
    db.add(row)
    db.commit()
    db.refresh(row)
    return CommentResponse(
        id=row.id,
        trade_id=row.trade_id,
        author_id=row.author_id,
        author_name=current_user.name,
        body=row.body,
        created_at=row.created_at.isoformat(),
    )
