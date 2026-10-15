import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.config import backend_path, settings
from app.core.db import get_db
from app.models.user import User
from app.schemas.admin_data import (
    AliasIn,
    AliasOut,
    BackfillIn,
    BackfillOut,
    CandleImportOut,
    DataStatusOut,
    TimeOffsetOut,
    UnresolvedOut,
)
from app.services.marketdata import admin_status
from app.services.marketdata.time_offsets import offsets_report

router = APIRouter(prefix="/api/admin", tags=["admin-data"])


def _alias(row) -> AliasOut:
    return AliasOut(id=str(row.id), broker=row.broker, raw_symbol=row.raw_symbol, canonical_symbol=row.canonical_symbol)


@router.get("/data-status", response_model=DataStatusOut)
def data_status(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    return admin_status.data_status(db)


@router.post("/backfill", response_model=BackfillOut, status_code=status.HTTP_201_CREATED)
def backfill(body: BackfillIn, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    return admin_status.enqueue_backfill(db, admin, body.symbol, body.start_ms, body.end_ms)


@router.post("/jobs/{job_id}/retry")
def retry_job(job_id: uuid.UUID, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    job = admin_status.retry_job(db, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return {"id": str(job.id), "status": job.status}


@router.get("/aliases", response_model=list[AliasOut])
def aliases(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    return [_alias(row) for row in admin_status.list_aliases(db)]


@router.post("/aliases", response_model=AliasOut, status_code=status.HTTP_201_CREATED)
def create_alias(body: AliasIn, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    return _alias(admin_status.create_alias(db, body.broker, body.raw_symbol, body.canonical, admin.email))


@router.delete("/aliases/{alias_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_alias(alias_id: uuid.UUID, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    if not admin_status.delete_alias(db, alias_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alias not found")


@router.get("/unresolved", response_model=list[UnresolvedOut])
def unresolved(limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    return admin_status.list_unresolved(db, limit=limit)


_MAX_IMPORT_BYTES = 50 * 1024 * 1024


def _import_path(raw: str) -> Path:
    root = backend_path(settings.market_data_dir).resolve()
    candidate = Path(raw).resolve()
    if candidate != root and root not in candidate.parents:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="path must sit inside the market-data directory")
    return candidate


@router.post("/candle-imports", response_model=CandleImportOut)
def import_candle_file(
    symbol: str = Form(...),
    preset: str = Form(...),
    label: str = Form(...),
    price_side: str = Form("bid"),
    timezone_name: str = Form(""),
    time_format: str = Form(""),
    separator: str = Form(","),
    columns: str = Form(""),
    dry_run: str = Form("false"),
    force: str = Form("false"),
    path: str = Form(""),
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    from app.services.marketdata.importer import CandleImportError, import_candles
    from app.services.marketdata.registry import get_instrument, mirror_to_db

    spec = get_instrument(symbol)
    if spec is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown instrument")
    mirror_to_db(db)
    if file is not None and file.filename:
        payload = file.file.read(_MAX_IMPORT_BYTES + 1)
        if len(payload) > _MAX_IMPORT_BYTES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="file is larger than 50MB; use the import-candles command")
        suffix = Path(file.filename).suffix.lower() or ".csv"
        if suffix not in (".csv", ".zip"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="upload a .csv or .zip file")
        with tempfile.NamedTemporaryFile(prefix="candle-import-", suffix=suffix, delete=False) as handle:
            handle.write(payload)
            target = Path(handle.name)
    elif path:
        target = _import_path(path)
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="choose a file or a path inside the market-data directory")
    try:
        summary = import_candles(
            db, spec, target,
            preset=preset, label=label, price_side=price_side,
            timezone_name=timezone_name, time_format=time_format,
            separator=separator, columns=columns,
            dry_run=dry_run.lower() in ("1", "true", "yes", "on"),
            force=force.lower() in ("1", "true", "yes", "on"),
        )
    except CandleImportError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.message) from exc
    finally:
        if file is not None and file.filename:
            target.unlink(missing_ok=True)
    return summary.as_dict()


@router.get("/time-offsets", response_model=list[TimeOffsetOut])
def list_time_offsets(
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    return offsets_report(db, limit=limit)
