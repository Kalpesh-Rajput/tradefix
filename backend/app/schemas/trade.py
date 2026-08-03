import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.trade import AssetType, TradeSide, TradeStatus


class TradeCreate(BaseModel):
    symbol: str
    asset_type: AssetType = AssetType.stock
    side: TradeSide = TradeSide.long
    quantity: float
    entry_price: float
    exit_price: float | None = None
    opened_at: datetime
    closed_at: datetime | None = None
    fees: float = 0
    setup_tag: str | None = None
    mood: str | None = None
    notes: str | None = None
    rules_broken: list[str] = Field(default_factory=list)
    status: TradeStatus = TradeStatus.closed
    account_id: uuid.UUID | None = None


class TradeUpdate(BaseModel):
    symbol: str | None = None
    asset_type: AssetType | None = None
    side: TradeSide | None = None
    quantity: float | None = None
    entry_price: float | None = None
    exit_price: float | None = None
    opened_at: datetime | None = None
    closed_at: datetime | None = None
    fees: float | None = None
    setup_tag: str | None = None
    mood: str | None = None
    notes: str | None = None
    rules_broken: list[str] | None = None
    status: TradeStatus | None = None


class TradeResponse(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    symbol: str
    asset_type: AssetType
    side: TradeSide
    quantity: float
    entry_price: float
    exit_price: float | None
    opened_at: datetime
    closed_at: datetime | None
    pnl: float | None
    fees: float
    setup_tag: str | None
    mood: str | None
    notes: str | None
    rules_broken: list[str]
    status: TradeStatus
    created_at: datetime

    class Config:
        from_attributes = True


class TradeImportResult(BaseModel):
    imported: int
    skipped_duplicates: int
    errors: list[str]
