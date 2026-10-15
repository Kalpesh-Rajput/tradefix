"""Manual session API contract. Client-generated ids make retries safe."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class SessionCreate(BaseModel):
    symbol: str = Field(min_length=3, max_length=32)
    timeframe: str = Field(pattern=r"^(1m|5m|15m|30m|1h|4h|1d)$")
    start_ms: int = Field(ge=0)
    end_ms: int | None = None
    initial_balance: float = Field(gt=0)
    currency: str = Field(default="USD", min_length=3, max_length=8)
    spread_pips: float = Field(default=0, ge=0)
    commission_per_lot: float = Field(default=0, ge=0)
    account_id: uuid.UUID | None = None


class SessionStateIn(BaseModel):
    cursor_ms: int = Field(ge=0)
    notes: str | None = Field(default=None, max_length=4000)


class OrderIn(BaseModel):
    id: uuid.UUID
    side: Literal["buy", "sell"]
    order_type: Literal["market", "limit", "stop"]
    size: float = Field(gt=0)
    price: float | None = None
    sl: float | None = None
    tp: float | None = None
    status: Literal["pending", "filled", "cancelled", "rejected"]
    created_ms: int = Field(ge=0)
    filled_ms: int | None = None


class OrderBatch(BaseModel):
    orders: list[OrderIn] = Field(max_length=200)


class TradeIn(BaseModel):
    id: uuid.UUID
    side: Literal["buy", "sell"]
    size: float = Field(gt=0)
    entry_ms: int = Field(ge=0)
    entry_price: float
    exit_ms: int = Field(ge=0)
    exit_price: float
    sl: float | None = None
    tp: float | None = None
    exit_reason: Literal["tp", "sl", "manual", "session end"]
    client_pnl: float | None = None
    notes: str | None = Field(default=None, max_length=2000)


class TradeBatch(BaseModel):
    trades: list[TradeIn] = Field(max_length=200)


class JournalSaveIn(BaseModel):
    account_id: uuid.UUID


class OrderOut(BaseModel):
    id: uuid.UUID
    side: str
    order_type: str
    size: float
    price: float | None
    sl: float | None
    tp: float | None
    status: str
    created_ms: int
    filled_ms: int | None


class TradeOut(BaseModel):
    id: uuid.UUID
    side: str
    size: float
    entry_ms: int
    entry_price: float
    exit_ms: int
    exit_price: float
    sl: float | None
    tp: float | None
    exit_reason: str
    commission: float
    pnl: float
    pips: float
    r_multiple: float | None
    pnl_currency: str
    discrepancy: bool
    notes: str | None


class SessionSummary(BaseModel):
    id: uuid.UUID
    symbol: str
    timeframe: str
    status: str
    start_ms: int
    end_ms: int | None
    cursor_ms: int
    initial_balance: float
    balance: float
    currency: str
    trade_count: int
    net_profit: float
    updated_at: datetime | None


class SessionStats(BaseModel):
    net_profit: float
    trade_count: int
    wins: int
    win_rate: float
    expectancy_r: float | None
    balance: float


class SessionDetail(SessionSummary):
    spread_pips: float
    commission_per_lot: float
    notes: str | None
    warnings: list[str]
    orders: list[OrderOut]
    trades: list[TradeOut]
    stats: SessionStats


class JournalSaveOut(BaseModel):
    trade_id: uuid.UUID
