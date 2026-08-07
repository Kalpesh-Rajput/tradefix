"""Coach-style AI Q&A grounded in Edge Finder stats."""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.user import User
from app.services import stats_service
from app.services.ai.openrouter_client import AiNotConfiguredError, generate_text

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/coach", tags=["coach"])

MIN_TRADES = 50


class CoachAskRequest(BaseModel):
    question: str = Field(min_length=3, max_length=1000)
    account_id: uuid.UUID | None = None


class CoachAskResponse(BaseModel):
    answer: str
    actions: list[str] = []
    locked: bool = False
    progress: int = 0
    required: int = MIN_TRADES


@router.get("/status")
def coach_status(
    account_id: uuid.UUID | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    overview = stats_service.overview_stats(db, current_user.id, account_id=account_id)
    trades = overview.get("total_trades", 0)
    eligible = trades >= MIN_TRADES
    return {
        "plan": current_user.plan or "free",
        "trades": trades,
        "required": MIN_TRADES,
        "eligible": eligible,
        "locked_reason": None if eligible else "need_trades",
    }


@router.post("/ask", response_model=CoachAskResponse)
def coach_ask(
    payload: CoachAskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    overview = stats_service.overview_stats(db, current_user.id, account_id=payload.account_id)
    trades_n = overview.get("total_trades", 0)
    if trades_n < MIN_TRADES:
        return CoachAskResponse(
            answer=f"Coach needs at least {MIN_TRADES} logged trades for grounded advice. You have {trades_n}.",
            locked=True,
            progress=trades_n,
            required=MIN_TRADES,
        )

    analytics = stats_service.full_analytics(
        db, current_user.id, account_id=payload.account_id
    )
    edge = analytics.get("edge_finder") or {}
    system = (
        "You are a trading performance coach. Use ONLY the provided stats. "
        "Never invent numbers. Reply with 1 short paragraph then 3-5 imperative action bullets "
        "(e.g. 'Avoid NY afternoon.', 'Risk 1%.', 'Only trade Breakout.')."
    )
    user_msg = (
        f"Question: {payload.question}\n\n"
        f"Overview: {overview}\n"
        f"Edge Finder: {edge}\n"
        f"By session: {analytics.get('by_session')}\n"
        f"Top tags: {(analytics.get('expectancy_by_tag') or [])[:5]}\n"
    )
    try:
        answer = generate_text(system, user_msg, max_tokens=500)
    except AiNotConfiguredError:
        actions = []
        if edge.get("best_hour"):
            actions.append(f"Focus on {edge['best_hour'].get('bucket')} window.")
        if edge.get("worst_symbol"):
            actions.append(f"Skip or size down {edge['worst_symbol'].get('bucket')}.")
        if edge.get("best_setup"):
            actions.append(f"Prioritize setup: {edge['best_setup'].get('tag')}.")
        if edge.get("worst_emotion"):
            actions.append(f"Avoid trading when feeling: {edge['worst_emotion'].get('tag')}.")
        actions.append("Keep risk fixed per trade.")
        answer = "Based on your Edge Finder stats, here is a focused plan.\n" + "\n".join(f"- {a}" for a in actions)
        return CoachAskResponse(answer=answer, actions=actions, progress=trades_n, required=MIN_TRADES)
    except Exception:
        logger.exception("Coach AI failed")
        raise HTTPException(status_code=502, detail="Coach temporarily unavailable")

    actions = [line.lstrip("-• ").strip() for line in answer.splitlines() if line.strip().startswith(("-", "•"))]
    return CoachAskResponse(answer=answer, actions=actions[:6], progress=trades_n, required=MIN_TRADES)


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
