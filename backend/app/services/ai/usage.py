from __future__ import annotations

import logging
import uuid

from sqlalchemy.orm import Session

from app.models.ai_usage import AiUsageLog

logger = logging.getLogger(__name__)


def record_usage(
    db: Session,
    *,
    user_id: uuid.UUID,
    request_id: uuid.UUID,
    model: str | None,
    input_tokens: int | None,
    output_tokens: int | None,
    total_tokens: int | None,
    request_type: str,
    intent: str | None,
    tools_used: list[str],
    latency_ms: int | None,
    success: bool,
    error_code: str | None = None,
) -> None:
    row = AiUsageLog(
        request_id=request_id,
        user_id=user_id,
        model=model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=total_tokens,
        request_type=request_type,
        intent=intent,
        tools_used=list(tools_used or []),
        latency_ms=latency_ms,
        success=success,
        error_code=error_code,
    )
    try:
        db.add(row)
        db.commit()
    except Exception:
        logger.exception("Failed to persist AI usage log")
        db.rollback()
