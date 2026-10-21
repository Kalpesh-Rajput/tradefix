from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.user import User
from app.schemas.chart_drawing import DrawingOut, SyncIn, SyncOut
from app.services import chart_drawings

router = APIRouter(prefix="/api/chart-drawings", tags=["chart-drawings"])


@router.get("", response_model=list[DrawingOut])
def list_drawings(
    workspace: str = Query(min_length=1, max_length=96),
    symbol: str = Query(min_length=1, max_length=32),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return chart_drawings.list_drawings(db, user, workspace, symbol)


@router.post("/sync", response_model=SyncOut)
def sync_drawings(payload: SyncIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return chart_drawings.sync(db, user, payload)


@router.delete("", response_model=dict)
def clear_drawings(
    workspace: str = Query(min_length=1, max_length=96),
    symbol: str = Query(min_length=1, max_length=32),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return {"deleted": chart_drawings.clear(db, user, workspace, symbol)}
