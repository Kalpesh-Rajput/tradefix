import uuid
from datetime import date as date_type
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

MAX_ITEMS = 40
MAX_EVENTS = 20
MAX_BRIEFING = 8_000
IMPACTS = ("high", "medium", "low")


class DayPlanItemCreate(BaseModel):
    label: str = Field(min_length=1, max_length=160)

    @field_validator("label")
    @classmethod
    def _clean_label(cls, value: str) -> str:
        label = (value or "").strip()
        if not label:
            raise ValueError("Label is required")
        return label[:160]


class DayPlanItemUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=160)
    done: bool | None = None
    sort_order: int | None = Field(default=None, ge=0, le=1000)

    @field_validator("label")
    @classmethod
    def _clean_label(cls, value: str | None) -> str | None:
        if value is None:
            return None
        label = value.strip()
        if not label:
            raise ValueError("Label is required")
        return label[:160]


class DayPlanItemResponse(BaseModel):
    id: uuid.UUID
    label: str
    done: bool
    sort_order: int
    created_at: datetime

    model_config = {"from_attributes": True}


class DayPlanEventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    note: str | None = Field(default=None, max_length=240)
    occurs_on: date_type | None = None
    impact: Literal["high", "medium", "low"] = "medium"

    @field_validator("title")
    @classmethod
    def _clean_title(cls, value: str) -> str:
        title = (value or "").strip()
        if not title:
            raise ValueError("Title is required")
        return title[:160]

    @field_validator("note")
    @classmethod
    def _clean_note(cls, value: str | None) -> str | None:
        if value is None:
            return None
        note = value.strip()
        return note[:240] or None


class DayPlanEventUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    note: str | None = Field(default=None, max_length=240)
    occurs_on: date_type | None = None
    impact: Literal["high", "medium", "low"] | None = None

    @field_validator("title")
    @classmethod
    def _clean_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        title = value.strip()
        if not title:
            raise ValueError("Title is required")
        return title[:160]

    @field_validator("note")
    @classmethod
    def _clean_note(cls, value: str | None) -> str | None:
        if value is None:
            return None
        note = value.strip()
        return note[:240] or None


class DayPlanEventResponse(BaseModel):
    id: uuid.UUID
    title: str
    note: str | None
    occurs_on: date_type
    impact: str
    sort_order: int
    created_at: datetime

    model_config = {"from_attributes": True}


class DayPlanUpdate(BaseModel):
    briefing: str = Field(default="", max_length=MAX_BRIEFING)

    @field_validator("briefing")
    @classmethod
    def _clean_briefing(cls, value: str) -> str:
        return (value or "")[:MAX_BRIEFING]


class DayPlanResponse(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    date: date_type
    briefing: str
    items: list[DayPlanItemResponse]
    events: list[DayPlanEventResponse]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
