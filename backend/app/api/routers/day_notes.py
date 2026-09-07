"""Day notes — one rich-text note per account per calendar day."""

from __future__ import annotations

import logging
import uuid
from datetime import date as date_type

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.db import get_db
from app.models.user import User
from app.schemas.day_note import DayNoteResponse, DayNoteUpdate, DayNoteUpsert
from app.services import day_notes_service as service
from app.services.rate_limit import screenshot_upload_limiter
from app.services.storage import delete_local_upload, save_day_note_screenshot

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/day-notes", tags=["day-notes"])


@router.get("", response_model=list[DayNoteResponse])
def list_day_notes(
    account_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return [service._to_response(n) for n in service.list_notes(db, current_user, account_id)]


@router.get("/by-day", response_model=DayNoteResponse)
def get_day_note_by_date(
    account_id: uuid.UUID = Query(...),
    date: date_type = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    note = service.get_by_day(db, current_user, account_id, date)
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return service._to_response(note)


@router.get("/{note_id}", response_model=DayNoteResponse)
def get_day_note(
    note_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service._to_response(service.get_note(db, current_user, note_id))


@router.put("", response_model=DayNoteResponse)
def upsert_day_note(
    payload: DayNoteUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service._to_response(service.upsert_note(db, current_user, payload))


@router.patch("/{note_id}", response_model=DayNoteResponse)
def patch_day_note(
    note_id: uuid.UUID,
    payload: DayNoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service._to_response(service.update_note(db, current_user, note_id, payload))


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_day_note(
    note_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service.delete_note(db, current_user, note_id)
    return None


@router.post("/{note_id}/screenshots", response_model=DayNoteResponse)
async def upload_day_note_screenshot(
    note_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    screenshot_upload_limiter.check(str(current_user.id))
    note = service.get_note(db, current_user, note_id)
    urls = list(note.screenshot_urls or [])
    if len(urls) >= settings.max_recap_screenshots:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum {settings.max_recap_screenshots} screenshots allowed",
        )
    data = await file.read()
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")
    try:
        url = save_day_note_screenshot(current_user.id, note.id, data, file.content_type)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Day-note screenshot save failed user=%s note=%s", current_user.id, note_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save screenshot",
        ) from None
    urls.append(url)
    note.screenshot_urls = urls
    db.commit()
    db.refresh(note)
    logger.info("Day-note screenshot uploaded user=%s note=%s", current_user.id, note_id)
    return service._to_response(note)


@router.delete("/{note_id}/screenshots", response_model=DayNoteResponse)
def delete_day_note_screenshot(
    note_id: uuid.UUID,
    url: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    note = service.get_note(db, current_user, note_id)
    urls = list(note.screenshot_urls or [])
    if url not in urls:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Screenshot not found")
    note.screenshot_urls = [u for u in urls if u != url]
    db.commit()
    db.refresh(note)
    delete_local_upload(url)
    return service._to_response(note)
