from __future__ import annotations

import logging
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.db import get_db
from app.models.user import User
from app.services.ai.heuristic import classify_question
from app.services.ai.openrouter_client import AiNotConfiguredError, AiProviderError, get_provider
from app.services.ai.orchestrator import ChatTurn, run_chat
from app.services.ai.tools.registry import TOOL_SCHEMAS

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["ai"])


class ChatHistoryMessage(BaseModel):
    role: Literal["user", "assistant", "coach"]
    content: str = Field(min_length=1, max_length=4000)


class AiChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    account_id: uuid.UUID | None = None
    history: list[ChatHistoryMessage] = Field(default_factory=list)


class AiSource(BaseModel):
    type: str
    id: str
    title: str
    date: str | None = None
    url: str | None = None
    snippet: str | None = None
    publisher: str | None = None


class AiChatResponse(BaseModel):
    answer: str
    actions: list[str] = []
    locked: bool = False
    progress: int = 0
    required: int = 0
    sources: list[AiSource] = []
    tools_used: list[str] = []
    intent: str = "direct"
    request_id: str | None = None
    warnings: list[str] = []


def execute_chat(db: Session, current_user: User, payload: AiChatRequest) -> AiChatResponse:
    history = [ChatTurn(role=item.role, content=item.content) for item in payload.history]
    try:
        result = run_chat(
            db,
            user_id=current_user.id,
            question=payload.question,
            account_id=payload.account_id,
            history=history,
        )
    except HTTPException:
        raise
    except AiNotConfiguredError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI is not configured. Set GROQ_API_KEY or OPENROUTER_API_KEY.",
        )
    except AiProviderError as exc:
        logger.exception("AI chat provider error")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Something went wrong while analyzing your data. Please try again.",
        ) from exc
    except Exception:
        logger.exception("AI chat failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Something went wrong while analyzing your data. Please try again.",
        )
    return AiChatResponse(
        answer=result.answer,
        actions=result.actions,
        locked=False,
        sources=[AiSource(**source) for source in result.sources],
        tools_used=result.tools_used,
        intent=result.intent,
        request_id=result.request_id,
        warnings=result.warnings,
    )


@router.post("/chat", response_model=AiChatResponse)
def ai_chat(
    payload: AiChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return execute_chat(db, current_user, payload)


@router.get("/health")
def ai_health(db: Session = Depends(get_db)):
    provider = get_provider()
    vector_extension = False
    try:
        row = db.execute(text("SELECT 1 FROM pg_extension WHERE extname = 'vector'")).first()
        vector_extension = row is not None
    except Exception:
        vector_extension = False
    return {
        "status": "ok" if provider.is_configured() else "unconfigured",
        "configured": provider.is_configured(),
        "provider": settings.active_ai_provider,
        "model": settings.ai_model,
        "embeddings_configured": bool(settings.openrouter_api_key and settings.openrouter_embedding_model),
        "vector_extension": vector_extension,
        "daily_limit": settings.ai_daily_limit,
        "hourly_limit": settings.ai_hourly_limit,
        "tools": [schema["function"]["name"] for schema in TOOL_SCHEMAS],
        "sample_intent": classify_question("What is my win rate?").intent,
    }
