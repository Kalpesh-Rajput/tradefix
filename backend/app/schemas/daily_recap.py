import uuid
from datetime import date as date_type
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, field_validator


DayMoodLiteral = Literal["good", "mixed", "tough"]


class DayPnlSummary(BaseModel):
    date: date_type
    trade_count: int = 0
    gross_pnl: float = 0.0
    fees: float = 0.0
    net_pnl: float = 0.0


class DailyRecapCreate(BaseModel):
    account_id: uuid.UUID
    date: date_type
    day_mood: DayMoodLiteral | None = None
    work_on: list[str] = Field(default_factory=list)
    best_decision: str | None = None
    reflection: str | None = None
    pnl_override: bool = False
    gross_pnl: Decimal | None = None
    fees: Decimal | None = None
    net_pnl: Decimal | None = None

    @field_validator("work_on")
    @classmethod
    def _cap_work_on(cls, value: list[str]) -> list[str]:
        cleaned: list[str] = []
        seen: set[str] = set()
        for item in value:
            label = (item or "").strip()
            if not label or label in seen:
                continue
            seen.add(label)
            cleaned.append(label[:100])
            if len(cleaned) >= 30:
                break
        return cleaned

    @field_validator("best_decision")
    @classmethod
    def _cap_best(cls, value: str | None) -> str | None:
        if value is None:
            return None
        text = value.strip()
        return text[:500] or None

    @field_validator("reflection")
    @classmethod
    def _cap_reflection(cls, value: str | None) -> str | None:
        if value is None:
            return None
        text = value.strip()
        return text[:5000] or None


class DailyRecapUpdate(BaseModel):
    day_mood: DayMoodLiteral | None = None
    work_on: list[str] | None = None
    best_decision: str | None = None
    reflection: str | None = None
    pnl_override: bool | None = None
    gross_pnl: Decimal | None = None
    fees: Decimal | None = None
    net_pnl: Decimal | None = None
    clear_day_mood: bool = False

    @field_validator("work_on")
    @classmethod
    def _cap_work_on(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        cleaned: list[str] = []
        seen: set[str] = set()
        for item in value:
            label = (item or "").strip()
            if not label or label in seen:
                continue
            seen.add(label)
            cleaned.append(label[:100])
            if len(cleaned) >= 30:
                break
        return cleaned

    @field_validator("best_decision")
    @classmethod
    def _cap_best(cls, value: str | None) -> str | None:
        if value is None:
            return None
        text = value.strip()
        return text[:500] or None

    @field_validator("reflection")
    @classmethod
    def _cap_reflection(cls, value: str | None) -> str | None:
        if value is None:
            return None
        text = value.strip()
        return text[:5000] or None


class DailyRecapResponse(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    date: date_type
    day_mood: DayMoodLiteral | None
    work_on: list[str]
    best_decision: str | None
    reflection: str | None
    pnl_override: bool
    gross_pnl: float | None
    fees: float | None
    net_pnl: float | None
    screenshot_urls: list[str]
    created_at: datetime
    updated_at: datetime
    # Computed from trades for the day (always present for display)
    computed_gross_pnl: float = 0.0
    computed_fees: float = 0.0
    computed_net_pnl: float = 0.0
    trade_count: int = 0
    # Display values: override fields when pnl_override else computed
    display_gross_pnl: float = 0.0
    display_fees: float = 0.0
    display_net_pnl: float = 0.0
    recap_number: int = 1

    class Config:
        from_attributes = True
