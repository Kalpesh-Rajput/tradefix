"""Day plan HTTP API. Identity always comes from the authenticated user."""

from __future__ import annotations

import uuid
from datetime import date as date_type

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.user import User
from app.schemas.day_plan import (
    DayPlanEventCreate,
    DayPlanEventUpdate,
    DayPlanItemCreate,
    DayPlanItemUpdate,
    DayPlanResponse,
    DayPlanUpdate,
)
from app.services import day_plans_service as svc

router = APIRouter(prefix="/api/day-plans", tags=["day-plans"])


@router.get("/by-day", response_model=DayPlanResponse)
def get_day_plan(
    account_id: uuid.UUID = Query(...),
    date: date_type = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return svc._to_response(svc.get_or_create(db, current_user, account_id, date))


@router.patch("/{plan_id}", response_model=DayPlanResponse)
def patch_day_plan(
    plan_id: uuid.UUID,
    payload: DayPlanUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return svc._to_response(svc.update_plan(db, current_user, plan_id, payload))


@router.post("/{plan_id}/items", response_model=DayPlanResponse)
def add_item(
    plan_id: uuid.UUID,
    payload: DayPlanItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return svc._to_response(svc.add_item(db, current_user, plan_id, payload))


@router.patch("/items/{item_id}", response_model=DayPlanResponse)
def patch_item(
    item_id: uuid.UUID,
    payload: DayPlanItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return svc._to_response(svc.update_item(db, current_user, item_id, payload))


@router.delete("/items/{item_id}", response_model=DayPlanResponse)
def delete_item(
    item_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return svc._to_response(svc.delete_item(db, current_user, item_id))


@router.post("/{plan_id}/events", response_model=DayPlanResponse)
def add_event(
    plan_id: uuid.UUID,
    payload: DayPlanEventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return svc._to_response(svc.add_event(db, current_user, plan_id, payload))


@router.patch("/events/{event_id}", response_model=DayPlanResponse)
def patch_event(
    event_id: uuid.UUID,
    payload: DayPlanEventUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return svc._to_response(svc.update_event(db, current_user, event_id, payload))


@router.delete("/events/{event_id}", response_model=DayPlanResponse)
def delete_event(
    event_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return svc._to_response(svc.delete_event(db, current_user, event_id))
