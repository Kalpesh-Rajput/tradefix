import uuid
from datetime import date as date_type
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class AgentTemplateResponse(BaseModel):
    key: str
    name: str
    description: str
    category: str
    triggers: list[str]
    reads: list[str]
    writes: list[str]
    implemented: bool
    coming_soon: bool


class UserAgentResponse(BaseModel):
    id: uuid.UUID
    template_key: str
    name: str
    description: str
    category: str
    status: str
    trigger_types: list[str]
    configuration: dict
    instructions: str
    last_run_at: datetime | None
    last_summary: str | None = None
    last_status: str | None = None
    created_at: datetime
    updated_at: datetime


class UserAgentCreate(BaseModel):
    template_key: str
    status: str = "active"
    trigger_types: list[str] | None = None
    configuration: dict | None = None
    instructions: str = ""


class UserAgentUpdate(BaseModel):
    status: str | None = None
    trigger_types: list[str] | None = None
    configuration: dict | None = None
    instructions: str | None = None


class AgentRunRequest(BaseModel):
    trigger: str = "manual"
    account_id: uuid.UUID | None = None
    date: date_type | None = None
    trade_ids: list[uuid.UUID] = Field(default_factory=list)


class AgentRunResponse(BaseModel):
    id: uuid.UUID
    agent_name: str
    user_agent_id: uuid.UUID | None = None
    status: str
    trigger: str | None = None
    message: str | None = None
    insight_id: uuid.UUID | None = None
    error: str | None = None
    input_context: dict = Field(default_factory=dict)
    output: dict = Field(default_factory=dict)
    details: dict = Field(default_factory=dict)
    started_at: datetime | None = None
    completed_at: datetime | None = None
    run_at: datetime

    model_config = {"from_attributes": True}


class AgentTriggerResponse(BaseModel):
    agent_name: str
    run: AgentRunResponse
    insight: dict | None = None


class NotificationResponse(BaseModel):
    id: uuid.UUID
    title: str
    body: str
    href: str
    read_at: datetime | None
    agent_run_id: uuid.UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class TagDecision(BaseModel):
    tag: str


def run_to_response(run) -> AgentRunResponse:
    payload: dict[str, Any] = {
        "id": run.id,
        "agent_name": run.agent_name,
        "user_agent_id": run.user_agent_id,
        "status": run.status.value if hasattr(run.status, "value") else str(run.status),
        "trigger": run.trigger,
        "message": run.message,
        "insight_id": run.insight_id,
        "error": run.error,
        "input_context": run.input_context or {},
        "output": run.output or {},
        "details": run.details or {},
        "started_at": run.started_at,
        "completed_at": run.completed_at,
        "run_at": run.run_at,
    }
    return AgentRunResponse(**payload)
