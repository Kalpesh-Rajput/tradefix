import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class AiInsightSnapshot(Base):
    __tablename__ = "ai_insight_snapshots"
    __table_args__ = (
        Index(
            "uq_ai_insight_snapshots_user_all",
            "user_id",
            unique=True,
            postgresql_where=text("account_id IS NULL"),
        ),
        Index(
            "uq_ai_insight_snapshots_user_account",
            "user_id",
            "account_id",
            unique=True,
            postgresql_where=text("account_id IS NOT NULL"),
        ),
        Index("ix_ai_insight_snapshots_user_id", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=True
    )
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    trades_analysed: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    latest_trade_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")

    user: Mapped["User"] = relationship()
