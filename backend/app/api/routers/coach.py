"""Coach-style AI Q&A. Chat is served by the AI orchestrator; weekly remains deterministic."""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.routers.ai import AiChatRequest, AiChatResponse, execute_chat
from app.core.db import get_db
from app.models.user import User
from app.services import stats_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/coach", tags=["coach"])

MIN_TRADES = 50


class CoachHistoryMessage(BaseModel):
    role: str = "user"
    content: str = Field(min_length=1, max_length=4000)


class CoachAskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    account_id: uuid.UUID | None = None
    history: list[CoachHistoryMessage] = Field(default_factory=list)


class CoachAskResponse(AiChatResponse):
    progress: int = 0
    required: int = 0


@router.get("/status")
def coach_status(
    account_id: uuid.UUID | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    overview = stats_service.overview_stats(db, current_user.id, account_id=account_id)
    trades = overview.get("total_trades", 0)
    return {
        "plan": current_user.plan or "free",
        "trades": trades,
        "required": MIN_TRADES,
        "eligible": True,
        "locked_reason": None,
    }


@router.post("/ask", response_model=CoachAskResponse)
def coach_ask(
    payload: CoachAskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    overview = stats_service.overview_stats(db, current_user.id, account_id=payload.account_id)
    trades_n = overview.get("total_trades", 0)
    history = []
    for item in payload.history:
        role = item.role if item.role in {"user", "assistant", "coach"} else "user"
        history.append({"role": role, "content": item.content})
    result = execute_chat(
        db,
        current_user,
        AiChatRequest(
            question=payload.question,
            account_id=payload.account_id,
            history=history,
        ),
    )
    return CoachAskResponse(
        **result.model_dump(),
        progress=trades_n,
        required=MIN_TRADES,
        locked=False,
    )


@router.get("/weekly")
def weekly_insight(
    account_id: uuid.UUID | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    analytics = stats_service.full_analytics(
        db,
        current_user.id,
        account_id=account_id,
    )
    edge = analytics.get("edge_finder") or {}
    overview = analytics.get("overview") or {}
    parts = []
    if overview.get("avg_execution_score") is not None:
        parts.append(f"Avg execution {overview['avg_execution_score']}/100.")
    if edge.get("best_day"):
        parts.append(f"Best day: {edge['best_day'].get('bucket')}.")
    if edge.get("worst_symbol"):
        parts.append(f"Watch {edge['worst_symbol'].get('bucket')}.")
    if edge.get("best_setup"):
        parts.append(f"Lean into {edge['best_setup'].get('tag')}.")
    insight = " ".join(parts) or "Log more tagged trades to unlock a sharper weekly coach note."
    return {"insight": insight, "edge_finder": edge, "timeline": analytics.get("performance_timeline") or []}
