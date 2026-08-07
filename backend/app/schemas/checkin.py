import uuid
from datetime import date as date_type
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class DailyCheckinUpsert(BaseModel):
    date: date_type
    account_id: uuid.UUID | None = None
    max_loss: Decimal | None = None
    max_trades: int | None = Field(default=None, ge=1, le=500)
    focus_setup: str | None = None
    goal_note: str | None = None
    followed: str | None = None  # yes | partial | no
    evening_note: str | None = None


class DailyCheckinResponse(BaseModel):
    id: uuid.UUID
    date: date_type
    account_id: uuid.UUID | None
    max_loss: float | None
    max_trades: int | None
    focus_setup: str | None
    goal_note: str | None
    followed: str | None
    evening_note: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MilestoneItem(BaseModel):
    id: str
    label: str
    description: str
    unlocked: bool
    progress: int
    target: int


class MilestonesResponse(BaseModel):
    items: list[MilestoneItem]
    unlocked_count: int
