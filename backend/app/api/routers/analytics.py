import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import csv
import io

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.user import User
from app.schemas.analytics import AnalyticsResponse
from app.services import stats_service

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("", response_model=AnalyticsResponse)
def get_analytics(
    account_id: uuid.UUID | None = Query(None),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    setup_tag: str | None = Query(None),
    emotion_tag: str | None = Query(None),
    symbol: str | None = Query(None),
    session: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return stats_service.full_analytics(
        db,
        current_user.id,
        account_id=account_id,
        date_from=date_from,
        date_to=date_to,
        setup_tag=setup_tag,
        emotion_tag=emotion_tag,
        symbol=symbol,
        session=session,
    )


@router.get("/expectancy-export")
def export_expectancy(
    account_id: uuid.UUID | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = stats_service.full_analytics(db, current_user.id, account_id=account_id)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["tag", "type", "trades", "win_rate", "pnl", "expectancy", "avg_r"])
    for row in data.get("expectancy_by_tag", []) + data.get("expectancy_by_emotion", []):
        writer.writerow(
            [
                row["tag"],
                row["tag_type"],
                row["trades"],
                row["win_rate"],
                row["pnl"],
                row["expectancy"],
                row.get("avg_r") or "",
            ]
        )
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=expectancy-by-tag.csv"},
    )
