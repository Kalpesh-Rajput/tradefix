import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class PropSettings(Base):
    __tablename__ = "prop_settings"
    __table_args__ = (UniqueConstraint("user_id", "account_id", name="uq_prop_settings_user_account"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False
    )
    profile: Mapped[str] = mapped_column(String(32), nullable=False, default="custom", server_default="custom")
    max_daily_loss_pct: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False, default=Decimal("5"))
    max_overall_drawdown_pct: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False, default=Decimal("10"))
    consistency_rule_pct: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    min_trading_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    warn_threshold_pct: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False, default=Decimal("80"))
    danger_threshold_pct: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False, default=Decimal("90"))
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="prop_settings")
