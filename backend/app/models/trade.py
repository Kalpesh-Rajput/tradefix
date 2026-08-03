import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, Text, func
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

    setup_tag: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    mood: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    rules_broken: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)

    status: Mapped[TradeStatus] = mapped_column(
        Enum(TradeStatus, name="trade_status", values_callable=lambda obj: [e.value for e in obj]),
        default=TradeStatus.closed,
        index=True,
    )
    extra: Mapped[dict] = mapped_column(JSONB, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="trades")
    account: Mapped["Account"] = relationship(back_populates="trades")
