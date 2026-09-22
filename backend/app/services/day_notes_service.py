import logging
import uuid
from datetime import date as date_type

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.day_note import DayNote
from app.models.notebook_folder import NotebookFolder
from app.models.user import User
from app.schemas.day_note import DayNoteResponse, DayNoteUpdate, DayNoteUpsert
from app.services.progress_tracker_service import touch_progress
from app.services.storage import delete_local_upload

logger = logging.getLogger(__name__)


def _owned_account(db: Session, user: User, account_id: uuid.UUID) -> Account:
    account = db.get(Account, account_id)
    if not account or account.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return account


def _to_response(note: DayNote) -> DayNoteResponse:
    payload = DayNoteResponse.model_validate(note)
    return payload.model_copy(update={"screenshot_urls": list(note.screenshot_urls or [])})


def get_note(db: Session, user: User, note_id: uuid.UUID) -> DayNote:
    note = db.get(DayNote, note_id)
    if not note or note.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return note


def get_by_day(db: Session, user: User, account_id: uuid.UUID, day: date_type) -> DayNote | None:
    _owned_account(db, user, account_id)
    return db.scalar(
        select(DayNote).where(
            DayNote.user_id == user.id,
            DayNote.account_id == account_id,
            DayNote.date == day,
        )
    )


def list_notes(db: Session, user: User, account_id: uuid.UUID) -> list[DayNote]:
    _owned_account(db, user, account_id)
    return list(
        db.scalars(
            select(DayNote)
            .where(DayNote.user_id == user.id, DayNote.account_id == account_id)
            .order_by(DayNote.date.desc())
        ).all()
    )


def _owned_folder(db: Session, user: User, account_id: uuid.UUID, folder_id: uuid.UUID | None) -> None:
    if folder_id is None:
        return
    folder = db.get(NotebookFolder, folder_id)
    if not folder or folder.user_id != user.id or folder.account_id != account_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")


def upsert_note(db: Session, user: User, payload: DayNoteUpsert) -> DayNote:
    _owned_account(db, user, payload.account_id)
    _owned_folder(db, user, payload.account_id, payload.folder_id)
    existing = get_by_day(db, user, payload.account_id, payload.date)
    if existing:
        existing.content = payload.content
        existing.template_id = payload.template_id
        if payload.is_favorite is not None:
            existing.is_favorite = payload.is_favorite
        if payload.folder_id is not None:
            existing.folder_id = payload.folder_id
        touch_progress(db, user, payload.date)
        db.commit()
        db.refresh(existing)
        logger.info("Updated day note %s for %s", existing.id, payload.date)
        from app.services.ai.rag.ingest import ingest_day_note, safe_ingest

        safe_ingest(db, lambda: ingest_day_note(db, existing))
        return existing

    note = DayNote(
        user_id=user.id,
        account_id=payload.account_id,
        date=payload.date,
        content=payload.content,
        template_id=payload.template_id,
        is_favorite=bool(payload.is_favorite),
        folder_id=payload.folder_id,
    )
    db.add(note)
    touch_progress(db, user, payload.date)
    db.commit()
    db.refresh(note)
    logger.info("Created day note %s for %s", note.id, payload.date)
    from app.services.ai.rag.ingest import ingest_day_note, safe_ingest

    safe_ingest(db, lambda: ingest_day_note(db, note))
    return note


def update_note(db: Session, user: User, note_id: uuid.UUID, payload: DayNoteUpdate) -> DayNote:
    note = get_note(db, user, note_id)
    data = payload.model_dump(exclude_unset=True)
    if "folder_id" in data:
        _owned_folder(db, user, note.account_id, data["folder_id"])
    for key, value in data.items():
        setattr(note, key, value)
    db.commit()
    db.refresh(note)
    from app.services.ai.rag.ingest import ingest_day_note, safe_ingest

    safe_ingest(db, lambda: ingest_day_note(db, note))
    return note


def delete_note(db: Session, user: User, note_id: uuid.UUID) -> None:
    note = get_note(db, user, note_id)
    for url in list(note.screenshot_urls or []):
        delete_local_upload(url)
    db.delete(note)
    from app.services.ai.rag.store import delete_document

    delete_document(db, user.id, "day_note", note_id)
    db.commit()
    logger.info("Deleted day note %s", note_id)
