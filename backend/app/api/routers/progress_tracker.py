"""Progress Tracker HTTP API. Identity always comes from the authenticated user."""

from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.user import User
from app.schemas.progress_tracker import (
    DailyProgressResponse,
    ManualCompletionRequest,
    ManualCompletionResponse,
    ProgressTrackerSettingsResponse,
    ProgressTrackerSettingsUpdate,
    ProgressTrackerSummaryResponse,
    ResetProgressResponse,
    StartDayRequest,
    StartDayResponse,
)
from app.services import progress_tracker_service as svc

router = APIRouter(prefix="/api/progress-tracker", tags=["progress-tracker"])


@router.get("/settings", response_model=ProgressTrackerSettingsResponse)
def get_settings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return svc.get_settings(db, current_user)


@router.put("/settings", response_model=ProgressTrackerSettingsResponse)
def put_settings(
    payload: ProgressTrackerSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return svc.update_settings(db, current_user, payload)


@router.get("/summary", response_model=ProgressTrackerSummaryResponse)
def get_summary(
    date_from: date = Query(...),
    date_to: date = Query(...),
    account_id: uuid.UUID | None = Query(None),
    focus_date: date | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return svc.get_summary(db, current_user, date_from, date_to, account_id, focus_date)


@router.get("/daily/{day}", response_model=DailyProgressResponse)
def get_daily(
    day: date,
    account_id: uuid.UUID | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return svc.get_daily(db, current_user, day, account_id)


@router.post("/start-day", response_model=StartDayResponse)
def start_day(
    payload: StartDayRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return svc.start_day(db, current_user, payload.date if payload else None)


@router.put("/manual-rules/{rule_id}/completion", response_model=ManualCompletionResponse)
def set_completion(
    rule_id: uuid.UUID,
    payload: ManualCompletionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return svc.set_manual_completion(db, current_user, rule_id, payload.date, payload.completed)


@router.post("/reset", response_model=ResetProgressResponse)
def reset_progress(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return svc.reset_progress(db, current_user)
