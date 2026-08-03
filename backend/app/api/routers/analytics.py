from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.user import User
from app.schemas.analytics import AnalyticsResponse
from app.services import stats_service

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("", response_model=AnalyticsResponse)
def get_analytics(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return stats_service.full_analytics(db, current_user.id)
