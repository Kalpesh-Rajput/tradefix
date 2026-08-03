import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class InsightSeverity(str, enum.Enum):
    info = "info"
    warning = "warning"
    critical = "critical"
    positive = "positive"


class InsightType(str, enum.Enum):
    time_edge = "TIME_EDGE"
    streak_alert = "STREAK_ALERT"
    setup_win = "SETUP_WIN"
    setup_decay = "SETUP_DECAY"
    morning_brief = "MORNING_BRIEF"
    pattern_scout = "PATTERN_SCOUT"
    risk_contribution = "RISK_CONTRIBUTION"
    hot_take = "HOT_TAKE"
    journal_pulse = "JOURNAL_PULSE"


class Insight(Base):
    __tablename__ = "insights"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    agent_name: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    type: Mapped[InsightType] = mapped_column(
        Enum(InsightType, name="insight_type", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[InsightSeverity] = mapped_column(
        Enum(InsightSeverity, name="insight_severity", values_callable=lambda obj: [e.value for e in obj]),
        default=InsightSeverity.info,
    )
    data: Mapped[dict] = mapped_column(JSONB, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    dismissed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="insights")
