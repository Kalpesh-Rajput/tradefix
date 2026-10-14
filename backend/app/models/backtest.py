"""Backtesting user data. Nothing here is ever joined into live trades or live analytics."""

import uuid
from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base

NOTE_MAX_LENGTH = 2000


class TradeReplayNote(Base):
    __tablename__ = "trade_replay_notes"
    __table_args__ = (
        CheckConstraint(f"char_length(text) BETWEEN 1 AND {NOTE_MAX_LENGTH}", name="ck_replay_note_text"),
        Index("ix_trade_replay_notes_user_trade", "user_id", "trade_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    trade_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("trades.id", ondelete="CASCADE"), nullable=False)
    replay_time_ms: Mapped[int] = mapped_column(BigInteger, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
