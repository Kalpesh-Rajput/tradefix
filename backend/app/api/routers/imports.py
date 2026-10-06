import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.routers.accounts import _owned_account, get_default_account
from app.core.db import SessionLocal, get_db
from app.models.broker import ImportBatch, ImportRow
from app.models.user import User
from app.schemas.trade import TradeImportResult
from app.services.csv_import_service import import_trades_from_csv
from app.services.imports.confirm import confirm_batch
from app.services.imports.parse import parse_upload

router = APIRouter(prefix="/api/imports", tags=["imports"])


def _tag_imported_trades(user_id, trade_ids) -> None:
    from app.services.ai.agents.executor import run_import_tagger

    db = SessionLocal()
    try:
        run_import_tagger(db, user_id, trade_ids)
    finally:
        db.close()


@router.post("/csv", response_model=TradeImportResult)
async def import_csv(
    file: UploadFile,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = get_default_account(db, current_user)
    file_bytes = await file.read()
    imported, skipped, errors, created_ids = import_trades_from_csv(db, current_user, account, file_bytes)
    if created_ids:
        background_tasks.add_task(_tag_imported_trades, current_user.id, created_ids)
    return TradeImportResult(imported=imported, skipped_duplicates=skipped, errors=errors)


@router.post("")
async def upload_import(
    file: UploadFile,
    account_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = _owned_account(db, account_id, current_user) if account_id else get_default_account(db, current_user)
    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail={"code": "UNKNOWN_ERROR", "message": "The file is empty."})
    detected, parsed = parse_upload(file.filename or "upload.csv", payload)
    attention = sum(1 for row in parsed if row["status"] != "valid")
    batch = ImportBatch(
        user_id=current_user.id,
        account_id=account.id,
        filename=file.filename or "upload.csv",
        detected_format=detected,
        status="preview",
        row_count=len(parsed),
        valid_count=len(parsed) - attention,
        attention_count=attention,
    )
    db.add(batch)
    db.flush()
    for row in parsed:
        db.add(
            ImportRow(
                user_id=current_user.id,
                batch_id=batch.id,
                row_number=row["row_number"],
                status=row["status"],
                errors=row["errors"],
                raw=row["raw"],
                normalized=row["normalized"],
            )
        )
    db.commit()
    return _batch_payload(db, batch)


@router.get("/{batch_id}")
def get_import(batch_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    batch = _owned_batch(db, current_user, batch_id)
    return _batch_payload(db, batch)


@router.patch("/{batch_id}/mapping")
def update_mapping(
    batch_id: uuid.UUID,
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    batch = _owned_batch(db, current_user, batch_id)
    batch.mapping = body.get("mapping") or {}
    db.commit()
    return _batch_payload(db, batch)


@router.post("/{batch_id}/confirm")
def confirm_import(batch_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    batch = _owned_batch(db, current_user, batch_id)
    if batch.status == "imported":
        raise HTTPException(status_code=409, detail={"code": "NOT_SUPPORTED", "message": "This file was already imported."})
    return confirm_batch(db, current_user, batch)


def _owned_batch(db: Session, user: User, batch_id: uuid.UUID) -> ImportBatch:
    batch = db.get(ImportBatch, batch_id)
    if batch is None or batch.user_id != user.id:
        raise HTTPException(status_code=404, detail={"code": "ACCOUNT_NOT_FOUND", "message": "Import not found."})
    return batch


def _batch_payload(db: Session, batch: ImportBatch) -> dict:
    rows = db.scalars(select(ImportRow).where(ImportRow.batch_id == batch.id, ImportRow.user_id == batch.user_id).order_by(ImportRow.row_number)).all()
    return {
        "id": str(batch.id),
        "filename": batch.filename,
        "detected_format": batch.detected_format,
        "status": batch.status,
        "row_count": batch.row_count,
        "valid_count": batch.valid_count,
        "duplicate_count": batch.duplicate_count,
        "attention_count": batch.attention_count,
        "rows": [
            {
                "row_number": row.row_number,
                "status": row.status,
                "errors": row.errors,
                "raw": row.raw,
                "normalized": row.normalized,
            }
            for row in rows[:200]
        ],
    }
