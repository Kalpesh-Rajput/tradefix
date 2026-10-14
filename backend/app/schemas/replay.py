"""Replay payload contract shared by journal, session and run replays (D-021). Times are epoch ms UTC."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.models.backtest import NOTE_MAX_LENGTH
from app.schemas.market_data import InstrumentOut


class ReplayTradeOut(BaseModel):
    side: Literal["long", "short"]
    size: float
    entry_ms: int
    entry_price: float
    exit_ms: int | None
    exit_price: float | None
    stop_loss: float | None
    take_profit: float | None
    fees: float | None


class AlignmentPoint(BaseModel):
    price: float
    candle_low: float | None
    candle_high: float | None
    status: Literal["inside", "outside", "no_candle"]
    outside_by: float = 0.0


class OffsetSuggestion(BaseModel):
    based_on: Literal["entry", "exit"]
    price_delta: float
    points: float


class AlignmentOut(BaseModel):
    tolerance: float
    entry: AlignmentPoint | None = None
    exit: AlignmentPoint | None = None
    offset_suggestion: OffsetSuggestion | None = None


class TimeBasisOut(BaseModel):
    basis: str
    rule: str
    tz_label: str | None = None


class ReplayPayload(BaseModel):
    status: Literal["ready", "preparing"]
    job_id: str | None = None
    source: Literal["journal", "session", "run"]
    trade_ref: str
    instrument: InstrumentOut
    trade: ReplayTradeOut
    default_timeframe: str
    suggested_start_ms: int
    window_start_ms: int
    window_end_ms: int
    alignment: AlignmentOut | None = None
    time_basis: TimeBasisOut
    price_note: str | None = None


class ReplayNoteIn(BaseModel):
    replay_time_ms: int = Field(ge=0)
    text: str = Field(min_length=1, max_length=NOTE_MAX_LENGTH)

    @field_validator("text")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Note can't be empty")
        return value


class ReplayNoteOut(BaseModel):
    id: str
    replay_time_ms: int
    text: str
    created_at: datetime | None


class SymbolInterestIn(BaseModel):
    raw_symbol: str = Field(min_length=1, max_length=64)
    broker: str | None = Field(None, max_length=64)


class SymbolInterestOut(BaseModel):
    recorded: bool
