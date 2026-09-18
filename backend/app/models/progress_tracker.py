import uuid
from datetime import date as date_type
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class ProgressTrackerSettings(Base):
    __tablename__ = "progress_tracker_settings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    active_days: Mapped[list] = mapped_column(
        JSONB, nullable=False, default=list, server_default='["mon","tue","wed","thu","fri"]'
    )
    reminder_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    reminder_time: Mapped[str] = mapped_column(String(5), nullable=False, default="20:15", server_default="20:15")
    trading_hours_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    trading_start_time: Mapped[str] = mapped_column(String(5), nullable=False, default="09:30", server_default="09:30")
    trading_end_time: Mapped[str] = mapped_column(String(5), nullable=False, default="16:00", server_default="16:00")
    start_day_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    start_day_time: Mapped[str] = mapped_column(String(5), nullable=False, default="09:00", server_default="09:00")
    link_playbook_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    stop_loss_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    max_loss_per_trade_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    max_loss_per_trade_mode: Mapped[str] = mapped_column(
        String(16), nullable=False, default="amount", server_default="amount"
    )
    max_loss_per_trade_value: Mapped[Decimal] = mapped_column(
        Numeric(18, 4), nullable=False, default=Decimal("0"), server_default="0"
    )
    max_loss_per_day_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    max_loss_per_day_value: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), nullable=False, default=Decimal("0"), server_default="0"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="progress_tracker_settings")


class ProgressTrackerConfigVersion(Base):
    __tablename__ = "progress_tracker_config_versions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    effective_from: Mapped[date_type] = mapped_column(Date, nullable=False)
    snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="progress_tracker_config_versions")


class ProgressTrackerManualRule(Base):
    __tablename__ = "progress_tracker_manual_rules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    schedule: Mapped[list] = mapped_column(
        JSONB, nullable=False, default=list, server_default='["mon","tue","wed","thu","fri"]'
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="progress_tracker_manual_rules")
    completions: Mapped[list["ProgressTrackerManualCompletion"]] = relationship(
        back_populates="rule", cascade="all, delete-orphan"
    )


class ProgressTrackerManualCompletion(Base):
    __tablename__ = "progress_tracker_manual_completions"
    __table_args__ = (
        UniqueConstraint("user_id", "rule_id", "date", name="uq_progress_tracker_completion_user_rule_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    rule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("progress_tracker_manual_rules.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    date: Mapped[date_type] = mapped_column(Date, nullable=False, index=True)
    completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="progress_tracker_manual_completions")
    rule: Mapped["ProgressTrackerManualRule"] = relationship(back_populates="completions")


class ProgressTrackerDayStart(Base):
    __tablename__ = "progress_tracker_day_starts"
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_progress_tracker_day_starts_user_date"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date: Mapped[date_type] = mapped_column(Date, nullable=False, index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="progress_tracker_day_starts")


class ProgressTrackerDailyResult(Base):
    __tablename__ = "progress_tracker_daily_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date: Mapped[date_type] = mapped_column(Date, nullable=False, index=True)
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=True
    )
    config_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("progress_tracker_config_versions.id", ondelete="SET NULL"), nullable=True
    )
    total_rules: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    passed_rules: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    failed_rules: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    pending_rules: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    not_applicable_rules: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    score: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    participated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    results: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    evaluated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="progress_tracker_daily_results")
