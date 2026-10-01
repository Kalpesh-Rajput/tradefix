import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class AgentRunStatus(str, enum.Enum):
    success = "success"
    skipped = "skipped"
    failed = "failed"
    running = "running"
    completed = "completed"
    partial = "partial"


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    user_agent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_agents.id", ondelete="SET NULL"), nullable=True, index=True
    )
    agent_name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    status: Mapped[AgentRunStatus] = mapped_column(
        Enum(AgentRunStatus, name="agent_run_status", values_callable=lambda obj: [e.value for e in obj]),
        default=AgentRunStatus.success,
    )
    trigger: Mapped[str | None] = mapped_column(String(32), nullable=True)
    message: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    insight_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("insights.id"), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    input_context: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    output: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    details: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict, server_default="{}")
    run_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="agent_runs")
    user_agent: Mapped["UserAgent | None"] = relationship(back_populates="runs")
    notifications: Mapped[list["UserNotification"]] = relationship(back_populates="agent_run")
