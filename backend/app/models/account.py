import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, default="Main Account")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    base_currency: Mapped[str] = mapped_column(String(10), nullable=False, default="USD", server_default="USD")
    initial_balance: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), nullable=False, default=Decimal("10000"), server_default="10000"
    )
    pnl_display_mode: Mapped[str] = mapped_column(
        String(16), nullable=False, default="net", server_default="net"
    )
    default_fee_per_trade: Mapped[Decimal] = mapped_column(
        Numeric(18, 4), nullable=False, default=Decimal("0"), server_default="0"
    )
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    source: Mapped[str] = mapped_column(String(16), nullable=False, default="dummy", server_default="dummy")
    broker_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    broker_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="accounts")
    trades: Mapped[list["Trade"]] = relationship(back_populates="account", cascade="all, delete-orphan")
    daily_recaps: Mapped[list["DailyRecap"]] = relationship(back_populates="account", cascade="all, delete-orphan")
    day_notes: Mapped[list["DayNote"]] = relationship(back_populates="account", cascade="all, delete-orphan")
    day_plans: Mapped[list["DayPlan"]] = relationship(back_populates="account", cascade="all, delete-orphan")
    notebook_folders: Mapped[list["NotebookFolder"]] = relationship(back_populates="account", cascade="all, delete-orphan")
