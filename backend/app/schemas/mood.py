import uuid
from datetime import date as date_type
from datetime import datetime

from pydantic import BaseModel, Field


class MoodCheckinCreate(BaseModel):
    date: date_type
    mood_score: int = Field(ge=1, le=5)
    notes: str | None = None


class MoodCheckinResponse(BaseModel):
    id: uuid.UUID
    date: date_type
    mood_score: int
    notes: str | None
    created_at: datetime

    class Config:
        from_attributes = True
