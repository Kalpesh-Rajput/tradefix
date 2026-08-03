from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.mood import MoodCheckin
from app.models.user import User
from app.schemas.mood import MoodCheckinCreate, MoodCheckinResponse

router = APIRouter(prefix="/api/mood", tags=["mood"])


@router.get("", response_model=list[MoodCheckinResponse])
def list_mood_checkins(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    stmt = (
        select(MoodCheckin)
        .where(MoodCheckin.user_id == current_user.id)
        .order_by(MoodCheckin.date.desc())
        .limit(90)
    )
    return db.scalars(stmt).all()


@router.post("", response_model=MoodCheckinResponse, status_code=status.HTTP_201_CREATED)
def upsert_mood_checkin(
    payload: MoodCheckinCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = db.scalar(
        select(MoodCheckin).where(
            MoodCheckin.user_id == current_user.id,
            MoodCheckin.date == payload.date,
        )
    )
    if existing:
        existing.mood_score = payload.mood_score
        existing.notes = payload.notes
        db.commit()
        db.refresh(existing)
        return existing

    checkin = MoodCheckin(
        user_id=current_user.id,
        date=payload.date,
        mood_score=payload.mood_score,
        notes=payload.notes,
    )
    db.add(checkin)
    db.commit()
    db.refresh(checkin)
    return checkin
