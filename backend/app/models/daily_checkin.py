import uuid
from datetime import date as date_type
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class DailyCheckin(Base):
    __tablename__ = "daily_checkins"
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_daily_checkins_user_date"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=True
    )
    date: Mapped[date_type] = mapped_column(Date, nullable=False, index=True)
    max_loss: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    max_trades: Mapped[int | None] = mapped_column(Integer, nullable=True)
    focus_setup: Mapped[str | None] = mapped_column(String(100), nullable=True)
    goal_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    followed: Mapped[str | None] = mapped_column(String(16), nullable=True)  # yes | partial | no
    evening_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="daily_checkins")
