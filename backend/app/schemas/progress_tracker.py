from __future__ import annotations

import uuid
from datetime import date as date_type
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

WEEKDAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
LossMode = Literal["amount", "percent"]
RuleStatus = Literal["passed", "failed", "pending", "not_applicable"]
BuiltInRuleKey = Literal[
    "trading_hours",
    "start_day",
    "link_playbook",
    "stop_loss",
    "max_loss_per_trade",
    "max_loss_per_day",
]


def _clean_time(value: str) -> str:
    raw = (value or "").strip()
    parts = raw.split(":")
    if len(parts) != 2:
        raise ValueError("Time must be HH:MM")
    try:
        hour = int(parts[0])
        minute = int(parts[1])
    except ValueError as exc:
        raise ValueError("Time must be HH:MM") from exc
    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        raise ValueError("Time must be a valid 24-hour clock value")
    return f"{hour:02d}:{minute:02d}"


def _clean_days(value: list[str] | None) -> list[str]:
    seen: list[str] = []
    for item in value or []:
        key = str(item).strip().lower()[:3]
        aliases = {
            "mo": "mon",
            "tu": "tue",
            "we": "wed",
            "th": "thu",
            "fr": "fri",
            "sa": "sat",
            "su": "sun",
            "mon": "mon",
            "tue": "tue",
            "wed": "wed",
            "thu": "thu",
            "fri": "fri",
            "sat": "sat",
            "sun": "sun",
        }
        day = aliases.get(key)
        if not day:
            raise ValueError(f"Invalid weekday: {item}")
        if day not in seen:
            seen.append(day)
    return seen


class ManualRuleInput(BaseModel):
    id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=160)
    schedule: list[str] = Field(default_factory=lambda: list(WEEKDAYS[:5]))
    sort_order: int = 0
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        cleaned = " ".join((v or "").split())
        if not cleaned:
            raise ValueError("Rule name is required")
        return cleaned[:160]

    @field_validator("schedule")
    @classmethod
    def _schedule(cls, v: list[str]) -> list[str]:
        days = _clean_days(v)
        if not days:
            raise ValueError("Select at least one day")
        return days


class ManualRuleResponse(BaseModel):
    id: uuid.UUID
    name: str
    schedule: list[str]
    sort_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProgressTrackerSettingsUpdate(BaseModel):
    active_days: list[str] = Field(default_factory=lambda: list(WEEKDAYS[:5]))
    reminder_enabled: bool = False
    reminder_time: str = "20:15"
    trading_hours_enabled: bool = False
    trading_start_time: str = "09:30"
    trading_end_time: str = "16:00"
    start_day_enabled: bool = False
    start_day_time: str = "09:00"
    link_playbook_enabled: bool = False
    stop_loss_required: bool = False
    max_loss_per_trade_enabled: bool = False
    max_loss_per_trade_mode: LossMode = "amount"
    max_loss_per_trade_value: float = 0
    max_loss_per_day_enabled: bool = False
    max_loss_per_day_value: float = 0
    manual_rules: list[ManualRuleInput] = Field(default_factory=list)

    @field_validator("active_days")
    @classmethod
    def _active_days(cls, v: list[str]) -> list[str]:
        days = _clean_days(v)
        if not days:
            raise ValueError("Select at least one trading day")
        return days

    @field_validator("reminder_time", "trading_start_time", "trading_end_time", "start_day_time")
    @classmethod
    def _times(cls, v: str) -> str:
        return _clean_time(v)

    @field_validator("max_loss_per_trade_value", "max_loss_per_day_value")
    @classmethod
    def _positive(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Loss threshold must be zero or positive")
        return v

    @model_validator(mode="after")
    def _validate_windows(self) -> "ProgressTrackerSettingsUpdate":
        if self.max_loss_per_trade_mode == "percent" and self.max_loss_per_trade_value > 100:
            raise ValueError("Percentage loss per trade must be between 0 and 100")
        if self.trading_hours_enabled and self.trading_start_time == self.trading_end_time:
            raise ValueError("Trading hours need a start time different from the end time")
        if self.max_loss_per_trade_enabled and self.max_loss_per_trade_value <= 0:
            raise ValueError("Set a maximum loss per trade greater than zero")
        if self.max_loss_per_day_enabled and self.max_loss_per_day_value <= 0:
            raise ValueError("Set a maximum loss per day greater than zero")
        return self


class ProgressTrackerSettingsResponse(BaseModel):
    active_days: list[str]
    reminder_enabled: bool
    reminder_time: str
    trading_hours_enabled: bool
    trading_start_time: str
    trading_end_time: str
    start_day_enabled: bool
    start_day_time: str
    link_playbook_enabled: bool
    stop_loss_required: bool
    max_loss_per_trade_enabled: bool
    max_loss_per_trade_mode: LossMode
    max_loss_per_trade_value: float
    max_loss_per_day_enabled: bool
    max_loss_per_day_value: float
    timezone: str
    manual_rules: list[ManualRuleResponse] = Field(default_factory=list)


class RuleResultResponse(BaseModel):
    rule_key: str
    rule_id: uuid.UUID | None = None
    name: str
    kind: Literal["builtin", "manual"]
    status: RuleStatus
    condition: str | None = None
    detail: str | None = None
    metadata: dict = Field(default_factory=dict)


class DailyProgressResponse(BaseModel):
    date: date_type
    is_trading_day: bool
    participated: bool
    started_at: datetime | None = None
    total_rules: int
    passed: int
    failed: int
    pending: int
    not_applicable: int
    score: float | None
    tracking: bool
    rules: list[RuleResultResponse] = Field(default_factory=list)


class HeatmapCellResponse(BaseModel):
    date: date_type
    score: float | None
    passed: int = 0
    failed: int = 0
    pending: int = 0
    total_applicable: int = 0
    is_trading_day: bool
    participated: bool
    tracking: bool
    future: bool = False


class RuleAnalyticsResponse(BaseModel):
    rule_key: str
    rule_id: uuid.UUID | None = None
    name: str
    kind: Literal["builtin", "manual"]
    condition: str | None = None
    streak: int = 0
    follow_rate: float | None = None
    average_performance: str | None = None
    passed: int = 0
    failed: int = 0
    pending: int = 0
    applicable: int = 0


class ProgressTrackerSummaryResponse(BaseModel):
    timezone: str
    today: date_type
    focus_date: date_type
    current_streak: int
    period_score: float | None
    today_passed: int
    today_total: int
    settings: ProgressTrackerSettingsResponse
    checklist: DailyProgressResponse
    heatmap: list[HeatmapCellResponse]
    rules: list[RuleAnalyticsResponse]


class StartDayRequest(BaseModel):
    date: date_type | None = None


class StartDayResponse(BaseModel):
    date: date_type
    started_at: datetime
    created: bool
    already_started: bool


class ManualCompletionRequest(BaseModel):
    date: date_type
    completed: bool = True


class ManualCompletionResponse(BaseModel):
    rule_id: uuid.UUID
    date: date_type
    completed: bool
    completed_at: datetime | None = None


class ResetProgressResponse(BaseModel):
    reset: bool = True
    deleted_results: int = 0
    deleted_completions: int = 0
    deleted_day_starts: int = 0
