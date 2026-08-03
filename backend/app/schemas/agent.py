import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.agent_run import AgentRunStatus


class AgentRunResponse(BaseModel):
    id: uuid.UUID
    agent_name: str
    status: AgentRunStatus
    message: str | None
    insight_id: uuid.UUID | None
    run_at: datetime

    class Config:
        from_attributes = True


class AgentTriggerResponse(BaseModel):
    agent_name: str
    run: AgentRunResponse
    insight: dict | None = None
