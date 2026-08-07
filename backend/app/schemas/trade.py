import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models.trade import AssetType, TradeSide, TradeStatus


def _cap_tags(value: list[str] | None, limit: int = 20) -> list[str]:
    if not value:
        return []
    out: list[str] = []
    seen: set[str] = set()
    for item in value:
        label = (item or "").strip()[:100]
        if not label or label.lower() in seen:
            continue
        seen.add(label.lower())
        out.append(label)
        if len(out) >= limit:
            break
    return out


class TradeCreate(BaseModel):
    symbol: str
    asset_type: AssetType = AssetType.stock
    side: TradeSide = TradeSide.long
    quantity: float
    entry_price: float
    exit_price: float | None = None
    opened_at: datetime
    closed_at: datetime | None = None
    fees: float | None = None
    risk_amount: float | None = None
    setup_tag: str | None = None
    setup_tags: list[str] = Field(default_factory=list)
    emotion_tags: list[str] = Field(default_factory=list)
    plan_compliance: int | None = Field(default=None, ge=1, le=10)
    mood: str | None = None
    notes: str | None = None
    rules_broken: list[str] = Field(default_factory=list)
    score_preparation: int | None = Field(default=None, ge=1, le=10)
    score_risk: int | None = Field(default=None, ge=1, le=10)
    score_entry: int | None = Field(default=None, ge=1, le=10)
    score_exit: int | None = Field(default=None, ge=1, le=10)
    score_discipline: int | None = Field(default=None, ge=1, le=10)
    score_psychology: int | None = Field(default=None, ge=1, le=10)
    status: TradeStatus = TradeStatus.closed
    account_id: uuid.UUID | None = None

    @field_validator("setup_tags", "emotion_tags", "rules_broken", mode="before")
    @classmethod
    def _tags(cls, v):
        if v is None:
            return []
        return _cap_tags(list(v) if not isinstance(v, list) else v)


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
    risk_amount: float | None = None
    setup_tag: str | None = None
    setup_tags: list[str] | None = None
    emotion_tags: list[str] | None = None
    plan_compliance: int | None = Field(default=None, ge=1, le=10)
    mood: str | None = None
    notes: str | None = None
    rules_broken: list[str] | None = None
    score_preparation: int | None = Field(default=None, ge=1, le=10)
    score_risk: int | None = Field(default=None, ge=1, le=10)
    score_entry: int | None = Field(default=None, ge=1, le=10)
    score_exit: int | None = Field(default=None, ge=1, le=10)
    score_discipline: int | None = Field(default=None, ge=1, le=10)
    score_psychology: int | None = Field(default=None, ge=1, le=10)
    voice_transcript: str | None = None
    status: TradeStatus | None = None

    @field_validator("setup_tags", "emotion_tags", "rules_broken", mode="before")
    @classmethod
    def _tags(cls, v):
        if v is None:
            return None
        return _cap_tags(list(v) if not isinstance(v, list) else v)


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
    risk_amount: float | None = None
    setup_tag: str | None
    setup_tags: list[str] = Field(default_factory=list)
    emotion_tags: list[str] = Field(default_factory=list)
    plan_compliance: int | None = None
    mood: str | None
    notes: str | None
    rules_broken: list[str]
    screenshot_urls: list[str] = Field(default_factory=list)
    voice_url: str | None = None
    voice_transcript: str | None = None
    score_preparation: int | None = None
    score_risk: int | None = None
    score_entry: int | None = None
    score_exit: int | None = None
    score_discipline: int | None = None
    score_psychology: int | None = None
    auto_flags: list[str] = Field(default_factory=list)
    status: TradeStatus
    created_at: datetime
    execution_score: int | None = None
    health_score: float | None = None
    r_multiple: float | None = None

    class Config:
        from_attributes = True


class TradeImportResult(BaseModel):
    imported: int
    skipped_duplicates: int
    errors: list[str]
