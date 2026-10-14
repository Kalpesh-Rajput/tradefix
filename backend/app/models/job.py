"""Generic database-backed job queue for market-data ingestion and backtests (D-002)."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base

ACTIVE_JOB_STATUSES = ("queued", "running")


class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (
        Index(
            "uq_jobs_active_dedup",
            "dedup_key",
            unique=True,
            postgresql_where=text("status IN ('queued', 'running') AND dedup_key IS NOT NULL"),
        ),
        Index("ix_jobs_runnable", "status", "next_run_at"),
        Index("ix_jobs_owner_created", "owner_user_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    lane: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="queued")
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    dedup_key: Mapped[str | None] = mapped_column(String(200), nullable=True)
    progress: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    progress_message: Mapped[str | None] = mapped_column(String(300), nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    next_run_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    locked_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancel_requested: Mapped[bool] = mapped_column(nullable=False, default=False, server_default="false")
    error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class WorkerHeartbeat(Base):
    __tablename__ = "worker_heartbeats"

    name: Mapped[str] = mapped_column(String(64), primary_key=True)
    instance: Mapped[str] = mapped_column(String(120), nullable=False)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    info: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
