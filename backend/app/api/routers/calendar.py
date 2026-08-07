import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.user import User
from app.schemas.analytics import CalendarResponse
from app.services import stats_service

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


@router.get("", response_model=CalendarResponse)
def get_calendar(
    start: date = Query(...),
    end: date = Query(...),
    account_id: uuid.UUID | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return stats_service.calendar_days(db, current_user.id, start, end, account_id=account_id)
