import logging
import uuid
from pathlib import Path

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
from app.services.imports.duplicates import existing_duplicate_keys, mark_duplicates
from app.services.imports.mapper import unmapped_required
from app.services.imports.parser import ParsedFile
from app.services.imports.pipeline import ImportFileError, build_preview, reprocess_rows, summarize
from app.services.rate_limit import import_upload_limiter

router = APIRouter(prefix="/api/imports", tags=["imports"])
logger = logging.getLogger(__name__)

_MAX_BYTES = 10 * 1024 * 1024
_ALLOWED = {".csv", ".xlsx", ".xml", ".htm", ".html"}


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
    import_upload_limiter.check(str(current_user.id))
    account = _owned_account(db, account_id, current_user) if account_id else get_default_account(db, current_user)
    filename = _safe_filename(file.filename)
    payload = await file.read()
    if len(payload) > _MAX_BYTES:
        raise HTTPException(
            status_code=400,
            detail={"code": "UNKNOWN_ERROR", "message": "File is larger than 10 MB."},
        )
    try:
        preview = build_preview(filename, payload)
    except ImportFileError as exc:
        raise HTTPException(status_code=400, detail={"code": "UNKNOWN_ERROR", "message": exc.message}) from exc
    existing = existing_duplicate_keys(db, current_user.id, account.id)
    mark_duplicates(preview.rows, existing)
    valid, duplicates, attention = summarize(preview.rows)
    batch = ImportBatch(
        user_id=current_user.id,
        account_id=account.id,
        filename=filename,
        detected_format=preview.detected_format,
        status="preview",
        mapping=_store_mapping(preview.headers, preview.mapping),
        row_count=len(preview.rows),
        valid_count=valid,
        duplicate_count=duplicates,
        attention_count=attention,
    )
    db.add(batch)
    db.flush()
    for row in preview.rows:
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
    logger.info(
        "import preview user=%s account=%s format=%s rows=%s valid=%s duplicates=%s attention=%s",
        current_user.id,
        account.id,
        preview.detected_format,
        len(preview.rows),
        valid,
        duplicates,
        attention,
    )
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
    if batch.status == "imported":
        raise HTTPException(status_code=409, detail={"code": "NOT_SUPPORTED", "message": "This file was already imported."})
    account_raw = body.get("account_id")
    if account_raw:
        try:
            account = _owned_account(db, uuid.UUID(str(account_raw)), current_user)
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail={"code": "UNKNOWN_ERROR", "message": "Choose an account from the list."},
            ) from exc
        batch.account_id = account.id
    override = body.get("mapping") or {}
    if not isinstance(override, dict):
        raise HTTPException(status_code=400, detail={"code": "UNKNOWN_ERROR", "message": "Mapping must be an object."})
    rows = _batch_rows(db, batch)
    headers = _headers(batch, rows)
    unknown = [str(column) for column in override.values() if column and str(column) not in headers]
    if unknown:
        raise HTTPException(
            status_code=400,
            detail={"code": "UNKNOWN_ERROR", "message": "That column is not in this file."},
        )
    parsed = ParsedFile(
        kind=batch.detected_format,
        headers=headers,
        records=[(row.row_number, dict(row.raw or {})) for row in rows],
    )
    existing = existing_duplicate_keys(db, current_user.id, batch.account_id)
    mapping, processed = reprocess_rows(parsed, override={str(key): str(value) for key, value in override.items() if value}, existing=existing)
    by_number = {row.row_number: row for row in rows}
    for item in processed:
        model = by_number.get(item["row_number"])
        if model is None:
            continue
        model.status = item["status"]
        model.errors = item["errors"]
        model.normalized = item["normalized"]
    valid, duplicates, attention = summarize(processed)
    batch.mapping = _store_mapping(headers, mapping)
    batch.row_count = len(processed)
    batch.valid_count = valid
    batch.duplicate_count = duplicates
    batch.attention_count = attention
    db.commit()
    return _batch_payload(db, batch)


@router.post("/{batch_id}/confirm")
def confirm_import(batch_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    batch = _owned_batch(db, current_user, batch_id)
    if batch.status == "imported":
        raise HTTPException(status_code=409, detail={"code": "NOT_SUPPORTED", "message": "This file was already imported."})
    result = confirm_batch(db, current_user, batch)
    logger.info(
        "import confirm user=%s batch=%s created=%s duplicates=%s attention=%s",
        current_user.id,
        batch.id,
        result.get("created"),
        result.get("duplicates"),
        result.get("attention"),
    )
    return result


def _safe_filename(filename: str | None) -> str:
    name = Path(filename or "upload.csv").name
    suffix = Path(name).suffix.lower()
    if suffix not in _ALLOWED:
        raise HTTPException(
            status_code=400,
            detail={"code": "NOT_SUPPORTED", "message": "Upload a CSV, Excel (.xlsx), or XML file."},
        )
    return name


def _store_mapping(headers: list[str], mapping: dict[str, str]) -> dict:
    return {"_headers": headers, **mapping}


def _headers(batch: ImportBatch, rows: list[ImportRow]) -> list[str]:
    stored = batch.mapping or {}
    headers = stored.get("_headers")
    if isinstance(headers, list) and headers:
        return [str(header) for header in headers]
    if rows and isinstance(rows[0].raw, dict):
        return [str(key) for key in rows[0].raw.keys()]
    return []


def _owned_batch(db: Session, user: User, batch_id: uuid.UUID) -> ImportBatch:
    batch = db.get(ImportBatch, batch_id)
    if batch is None or batch.user_id != user.id:
        raise HTTPException(status_code=404, detail={"code": "ACCOUNT_NOT_FOUND", "message": "Import not found."})
    return batch


def _batch_rows(db: Session, batch: ImportBatch) -> list[ImportRow]:
    return list(
        db.scalars(
            select(ImportRow)
            .where(ImportRow.batch_id == batch.id, ImportRow.user_id == batch.user_id)
            .order_by(ImportRow.row_number)
        ).all()
    )


def _batch_payload(db: Session, batch: ImportBatch) -> dict:
    rows = _batch_rows(db, batch)
    mapping = {
        str(key): str(value)
        for key, value in (batch.mapping or {}).items()
        if not str(key).startswith("_") and value
    }
    return {
        "id": str(batch.id),
        "account_id": str(batch.account_id),
        "filename": batch.filename,
        "detected_format": batch.detected_format,
        "status": batch.status,
        "row_count": batch.row_count,
        "valid_count": batch.valid_count,
        "duplicate_count": batch.duplicate_count,
        "attention_count": batch.attention_count,
        "headers": _headers(batch, rows),
        "mapping": mapping,
        "unmapped_required": unmapped_required(mapping),
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
