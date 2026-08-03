import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.insight import Insight
from app.models.user import User
from app.schemas.insight import InsightResponse
from app.services.insight_rules import run_all_rules

router = APIRouter(prefix="/api/insights", tags=["insights"])


@router.get("", response_model=list[InsightResponse])
def list_insights(
    include_dismissed: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Insight).where(Insight.user_id == current_user.id)
    if not include_dismissed:
        stmt = stmt.where(Insight.dismissed_at.is_(None))
    stmt = stmt.order_by(Insight.created_at.desc()).limit(100)
    return db.scalars(stmt).all()


@router.post("/generate", response_model=list[InsightResponse])
def generate_insights(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Runs the deterministic rule engine on-demand (no LLM, no API key needed)."""
    return run_all_rules(db, current_user.id)


@router.post("/{insight_id}/dismiss", response_model=InsightResponse)
def dismiss_insight(insight_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    insight = db.get(Insight, insight_id)
    if not insight or insight.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Insight not found")
    insight.dismissed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(insight)
    return insight
