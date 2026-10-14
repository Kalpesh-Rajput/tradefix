"""Detected trade-time basis per journal account (backtesting D-013, D-023)."""

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class AccountTimeOffset(Base):
    __tablename__ = "account_time_offsets"
    __table_args__ = (
        CheckConstraint("tz_kind IN ('iana', 'fixed', 'ny_close')", name="ck_time_offset_kind"),
        CheckConstraint("confidence IN ('high', 'medium', 'low', 'unknown')", name="ck_time_offset_confidence"),
    )

    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    broker_account_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    tz_kind: Mapped[str] = mapped_column(String(16), nullable=False)
    tz_value: Mapped[str] = mapped_column(String(64), nullable=False)
    confidence: Mapped[str] = mapped_column(String(16), nullable=False)
    match_rate: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    sample_size: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    runner_up: Mapped[str | None] = mapped_column(String(64), nullable=True)
    runner_up_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    method: Mapped[str] = mapped_column(String(32), nullable=False)
    scores: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
