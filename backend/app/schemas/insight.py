import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.insight import InsightSeverity, InsightType


class InsightResponse(BaseModel):
    id: uuid.UUID
    agent_name: str | None
    type: InsightType
    title: str
    body: str
    severity: InsightSeverity
    data: dict
    created_at: datetime
    dismissed_at: datetime | None

    class Config:
        from_attributes = True
