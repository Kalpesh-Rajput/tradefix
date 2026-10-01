import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class UserAgentStatus(str, enum.Enum):
    active = "active"
    paused = "paused"


class UserAgent(Base):
    __tablename__ = "user_agents"
    __table_args__ = (UniqueConstraint("user_id", "template_key", name="uq_user_agents_user_template"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    template_key: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=UserAgentStatus.paused.value, server_default="paused")
    trigger_types: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    configuration: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    instructions: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="user_agents")
    runs: Mapped[list["AgentRun"]] = relationship(back_populates="user_agent")
