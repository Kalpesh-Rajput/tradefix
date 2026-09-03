import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class AssetType(str, enum.Enum):
    stock = "stock"
    option = "option"
    future = "future"
    forex = "forex"
    crypto = "crypto"


class TradeSide(str, enum.Enum):
    long = "long"
    short = "short"


class TradeStatus(str, enum.Enum):
    open = "open"
    closed = "closed"


class Trade(Base):
    __tablename__ = "trades"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False)

    symbol: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    asset_type: Mapped[AssetType] = mapped_column(
        Enum(AssetType, name="asset_type", values_callable=lambda obj: [e.value for e in obj]),
        default=AssetType.stock,
    )
    side: Mapped[TradeSide] = mapped_column(
        Enum(TradeSide, name="trade_side", values_callable=lambda obj: [e.value for e in obj]),
        default=TradeSide.long,
    )

    quantity: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    entry_price: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    exit_price: Mapped[float | None] = mapped_column(Numeric(18, 6), nullable=True)

    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)

    pnl: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    fees: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    risk_amount: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)

    setup_tag: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    setup_tags: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    emotion_tags: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    plan_compliance: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mood: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    rules_broken: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    screenshot_urls: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    voice_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    voice_transcript: Mapped[str | None] = mapped_column(Text, nullable=True)

    score_preparation: Mapped[int | None] = mapped_column(Integer, nullable=True)
    score_risk: Mapped[int | None] = mapped_column(Integer, nullable=True)
    score_entry: Mapped[int | None] = mapped_column(Integer, nullable=True)
    score_exit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    score_discipline: Mapped[int | None] = mapped_column(Integer, nullable=True)
    score_psychology: Mapped[int | None] = mapped_column(Integer, nullable=True)
    auto_flags: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")

    status: Mapped[TradeStatus] = mapped_column(
        Enum(TradeStatus, name="trade_status", values_callable=lambda obj: [e.value for e in obj]),
        default=TradeStatus.closed,
        index=True,
    )
    extra: Mapped[dict] = mapped_column(JSONB, default=dict)

    session: Mapped[str | None] = mapped_column(String(64), nullable=True)
    trade_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    option_type: Mapped[str | None] = mapped_column(String(16), nullable=True)
    analysis_timeframe: Mapped[str | None] = mapped_column(String(32), nullable=True)
    entry_timeframe: Mapped[str | None] = mapped_column(String(32), nullable=True)
    stop_loss: Mapped[float | None] = mapped_column(Numeric(18, 6), nullable=True)
    invested_amount: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    entry_condition: Mapped[str | None] = mapped_column(String(120), nullable=True)
    exit_condition: Mapped[str | None] = mapped_column(String(120), nullable=True)
    sell_quantity: Mapped[float | None] = mapped_column(Numeric(18, 6), nullable=True)
    total_sell_amount: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    leverage: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True)
    contract_size: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True)
    is_favourite: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false", index=True)
    is_sync: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    is_close: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    is_equity: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    year: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    month: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    strategy_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    strategy_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    precheck_list_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("precheck_lists.id", ondelete="SET NULL"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="trades")
    account: Mapped["Account"] = relationship(back_populates="trades")
    executions: Mapped[list["TradeExecution"]] = relationship(
        back_populates="trade", cascade="all, delete-orphan", order_by="TradeExecution.sort_order"
    )
    precheck_list: Mapped["PrecheckList | None"] = relationship(back_populates="trades")


class ExecutionLegType(str, enum.Enum):
    entry = "entry"
    exit = "exit"


class TradeExecution(Base):
    __tablename__ = "trade_executions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trade_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trades.id", ondelete="CASCADE"), nullable=False, index=True
    )
    leg_type: Mapped[ExecutionLegType] = mapped_column(
        Enum(ExecutionLegType, name="execution_leg_type", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    quantity: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    price: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    executed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    fees: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0, server_default="0")
    condition: Mapped[str | None] = mapped_column(String(120), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    trade: Mapped["Trade"] = relationship(back_populates="executions")
