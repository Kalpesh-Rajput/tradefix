from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.db import get_db
from app.models.user import User
from app.schemas.admin_data import TimeOffsetOut
from app.services.marketdata.time_offsets import offsets_report

router = APIRouter(prefix="/api/admin", tags=["admin-data"])


@router.get("/time-offsets", response_model=list[TimeOffsetOut])
def list_time_offsets(
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    return offsets_report(db, limit=limit)
