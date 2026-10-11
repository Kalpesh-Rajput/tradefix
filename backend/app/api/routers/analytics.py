import uuid
from datetime import date, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import csv
import io

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.user import User
from app.schemas.advanced_analytics import AdvancedAnalyticsResponse, DrilldownResponse
from app.schemas.analytics import AnalyticsResponse
from app.services import advanced_analytics, stats_service
from app.services.advanced_analytics.core import DIMENSIONS, Filters
from app.services.rate_limit import advanced_analytics_limiter, analytics_drilldown_limiter

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

MAX_RANGE_DAYS = 3660
MAX_FILTER_VALUES = 20
MAX_FILTER_LEN = 120


def _clean_values(name: str, values: list[str]) -> list[str]:
    if len(values) > MAX_FILTER_VALUES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Too many {name} values (max {MAX_FILTER_VALUES}).")
    out: list[str] = []
    for value in values:
        text = (value or "").strip()
        if not text:
            continue
        if len(text) > MAX_FILTER_LEN or any(ord(ch) < 32 for ch in text):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Invalid {name} value.")
        out.append(text)
    return out


def _filters(
    date_from: date | None,
    date_to: date | None,
    symbol: list[str],
    session: list[str],
    setup_tag: list[str],
    emotion_tag: list[str],
) -> Filters:
    if date_from and date_to:
        if date_from > date_to:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "date_from must be on or before date_to.")
        if (date_to - date_from).days > MAX_RANGE_DAYS:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Date range is too long (max 10 years).")
    return Filters(
        date_from=date_from,
        date_to=date_to,
        symbols=_clean_values("symbol", symbol),
        sessions=_clean_values("session", session),
        setups=_clean_values("setup_tag", setup_tag),
        emotions=_clean_values("emotion_tag", emotion_tag),
    )


@router.get("/advanced", response_model=AdvancedAnalyticsResponse)
def get_advanced_analytics(
    account_id: uuid.UUID = Query(...),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    symbol: list[str] = Query([]),
    session: list[str] = Query([]),
    setup_tag: list[str] = Query([]),
    emotion_tag: list[str] = Query([]),
    pnl_mode: Literal["net", "gross"] = Query("net"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    advanced_analytics_limiter.check(f"advanced:{current_user.id}")
    filters = _filters(date_from, date_to, symbol, session, setup_tag, emotion_tag)
    try:
        return advanced_analytics.build_advanced(db, current_user, account_id, filters, pnl_mode=pnl_mode)
    except advanced_analytics.AccountNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found.")


@router.get("/advanced/drilldown", response_model=DrilldownResponse)
def get_advanced_drilldown(
    account_id: uuid.UUID = Query(...),
    dimension: str = Query(..., max_length=32),
    key: str = Query(..., min_length=1, max_length=MAX_FILTER_LEN),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    symbol: list[str] = Query([]),
    session: list[str] = Query([]),
    setup_tag: list[str] = Query([]),
    emotion_tag: list[str] = Query([]),
    pnl_mode: Literal["net", "gross"] = Query("net"),
    limit: int = Query(advanced_analytics.DRILL_LIMIT, ge=1, le=advanced_analytics.DRILL_LIMIT),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    analytics_drilldown_limiter.check(f"drill:{current_user.id}")
    if dimension not in DIMENSIONS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown drill-down dimension.")
    if any(ord(ch) < 32 for ch in key):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid drill-down key.")
    filters = _filters(date_from, date_to, symbol, session, setup_tag, emotion_tag)
    try:
        return advanced_analytics.drilldown(
            db,
            current_user,
            account_id,
            filters,
            dimension=dimension,
            key=key,
            pnl_mode=pnl_mode,
            limit=limit,
        )
    except advanced_analytics.AccountNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found.")


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
