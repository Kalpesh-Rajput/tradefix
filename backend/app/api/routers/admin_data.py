import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.db import get_db
from app.models.user import User
from app.schemas.admin_data import AliasIn, AliasOut, BackfillIn, BackfillOut, DataStatusOut, TimeOffsetOut, UnresolvedOut
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


@router.get("/time-offsets", response_model=list[TimeOffsetOut])
def list_time_offsets(
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    return offsets_report(db, limit=limit)
