"""Market-data API contract. Candles travel as columnar arrays; all times are epoch ms UTC."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel


class InstrumentOut(BaseModel):
    symbol: str
    asset_class: str
    source: str
    market_type: str
    pip_size: float
    contract_size: float
    quote_currency: str
    price_decimals: int
    enabled: bool
    verified_on: date | None = None


class CandlesOut(BaseModel):
    status: Literal["ready"] = "ready"
    symbol: str
    timeframe: str
    t: list[int]
    o: list[float]
    h: list[float]
    l: list[float]  # noqa: E741
    c: list[float]
    v: list[float]
    earliest_ms: int | None
    has_more_before: bool
    has_more_after: bool
    complete_until_ms: int


class DataJobOut(BaseModel):
    id: str
    type: str
    status: str
    progress: int
    progress_message: str | None = None
    error_code: str | None = None
    error_message: str | None = None
    created_at: datetime | None = None
    finished_at: datetime | None = None
