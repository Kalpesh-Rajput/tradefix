import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.trade import AssetType, ExecutionLegType, TradeSide, TradeStatus


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


def _blank_to_none(v):
    if v is None:
        return None
    if isinstance(v, str) and not v.strip():
        return None
    return v


class TradeExecutionInput(BaseModel):
    id: uuid.UUID | None = None
    leg_type: ExecutionLegType = ExecutionLegType.entry
    quantity: float = Field(gt=0)
    price: float = Field(gt=0)
    executed_at: datetime
    fees: float | None = 0
    condition: str | None = None
    notes: str | None = None
    sort_order: int = 0


class TradeExecutionResponse(BaseModel):
    id: uuid.UUID
    leg_type: ExecutionLegType
    quantity: float
    price: float
    executed_at: datetime
    fees: float = 0
    condition: str | None = None
    notes: str | None = None
    sort_order: int = 0

    class Config:
        from_attributes = True


class TradeJournalFields(BaseModel):
    session: str | None = None
    trade_type: str | None = None
    option_type: str | None = None
    analysis_timeframe: str | None = None
    entry_timeframe: str | None = None
    stop_loss: float | None = None
    entry_condition: str | None = None
    exit_condition: str | None = None
    leverage: float | None = None
    contract_size: float | None = None
    is_favourite: bool | None = None
    mood: str | None = None
    strategy_name: str | None = None
    strategy_id: uuid.UUID | None = None
    precheck_list_id: uuid.UUID | None = None
    extra: dict | None = None

    @field_validator(
        "session",
        "trade_type",
        "analysis_timeframe",
        "entry_timeframe",
        "entry_condition",
        "exit_condition",
        "mood",
        "strategy_name",
        mode="before",
    )
    @classmethod
    def _empty(cls, v):
        return _blank_to_none(v)

    @field_validator("option_type", mode="before")
    @classmethod
    def _option(cls, v):
        v = _blank_to_none(v)
        if v is None:
            return None
        val = str(v).strip().lower()
        if val in ("call", "put"):
            return val
        if val in ("none", "n/a", "-"):
            return None
        return val


class TradeCreate(TradeJournalFields):
    symbol: str
    asset_type: AssetType = AssetType.stock
    side: TradeSide = TradeSide.long
    quantity: float | None = None
    entry_price: float | None = None
    exit_price: float | None = None
    sell_quantity: float | None = None
    opened_at: datetime
    closed_at: datetime | None = None
    fees: float | None = None
    risk_amount: float | None = None
    setup_tag: str | None = None
    setup_tags: list[str] = Field(default_factory=list)
    emotion_tags: list[str] = Field(default_factory=list)
    plan_compliance: int | None = Field(default=None, ge=1, le=10)
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
    executions: list[TradeExecutionInput] = Field(default_factory=list)

    @field_validator("setup_tags", "emotion_tags", "rules_broken", mode="before")
    @classmethod
    def _tags(cls, v):
        if v is None:
            return []
        return _cap_tags(list(v) if not isinstance(v, list) else v)

    @model_validator(mode="after")
    def _require_entry(self):
        has_exec = any(e.leg_type.value == "entry" or e.leg_type == ExecutionLegType.entry for e in self.executions)
        if not has_exec and (not self.quantity or not self.entry_price):
            raise ValueError("Quantity and entry price are required")
        if self.quantity is not None and self.quantity <= 0 and not has_exec:
            raise ValueError("Quantity must be greater than 0")
        if self.entry_price is not None and self.entry_price <= 0 and not has_exec:
            raise ValueError("Entry price must be greater than 0")
        return self


class TradeUpdate(TradeJournalFields):
    symbol: str | None = None
    asset_type: AssetType | None = None
    side: TradeSide | None = None
    quantity: float | None = None
    entry_price: float | None = None
    exit_price: float | None = None
    sell_quantity: float | None = None
    opened_at: datetime | None = None
    closed_at: datetime | None = None
    fees: float | None = None
    risk_amount: float | None = None
    setup_tag: str | None = None
    setup_tags: list[str] | None = None
    emotion_tags: list[str] | None = None
    plan_compliance: int | None = Field(default=None, ge=1, le=10)
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
    executions: list[TradeExecutionInput] | None = None

    @field_validator("setup_tags", "emotion_tags", "rules_broken", mode="before")
    @classmethod
    def _tags(cls, v):
        if v is None:
            return None
        return _cap_tags(list(v) if not isinstance(v, list) else v)


class TradeResponse(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    account_name: str | None = None
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
    session: str | None = None
    trade_type: str | None = None
    option_type: str | None = None
    analysis_timeframe: str | None = None
    entry_timeframe: str | None = None
    stop_loss: float | None = None
    invested_amount: float | None = None
    entry_condition: str | None = None
    exit_condition: str | None = None
    sell_quantity: float | None = None
    total_sell_amount: float | None = None
    leverage: float | None = None
    contract_size: float | None = None
    is_favourite: bool = False
    is_deleted: bool = False
    is_sync: bool = False
    is_close: bool = False
    is_equity: bool = False
    is_profit: bool | None = None
    year: int | None = None
    month: int | None = None
    strategy_name: str | None = None
    strategy_id: uuid.UUID | None = None
    precheck_list_id: uuid.UUID | None = None
    extra: dict = Field(default_factory=dict)
    remaining_quantity: float | None = None
    executions: list[TradeExecutionResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class TradeImportResult(BaseModel):
    imported: int
    skipped_duplicates: int
    errors: list[str]
