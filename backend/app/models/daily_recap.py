import enum
import uuid
from datetime import date as date_type
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Numeric, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class DayMood(str, enum.Enum):
    good = "good"
    mixed = "mixed"
    tough = "tough"


class DailyRecap(Base):
    __tablename__ = "daily_recaps"
    __table_args__ = (
        UniqueConstraint("user_id", "account_id", "date", name="uq_daily_recaps_user_account_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date: Mapped[date_type] = mapped_column(Date, nullable=False, index=True)

    day_mood: Mapped[DayMood | None] = mapped_column(
        Enum(DayMood, name="day_mood", values_callable=lambda obj: [e.value for e in obj]),
        nullable=True,
    )
    work_on: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    best_decision: Mapped[str | None] = mapped_column(Text, nullable=True)
    reflection: Mapped[str | None] = mapped_column(Text, nullable=True)

    pnl_override: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    gross_pnl: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    fees: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    net_pnl: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)

    screenshot_urls: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="daily_recaps")
    account: Mapped["Account"] = relationship(back_populates="daily_recaps")
