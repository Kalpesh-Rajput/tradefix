"""Chart drawings: user-owned annotations anchored to chart time and price. Never joined into trades or analytics."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base

SCHEMA_VERSION = 1
MAX_ANCHORS = 12


class ChartDrawing(Base):
    __tablename__ = "chart_drawings"
    __table_args__ = (
        CheckConstraint("schema_version >= 1", name="ck_chart_drawing_version"),
        CheckConstraint("char_length(workspace) BETWEEN 1 AND 96", name="ck_chart_drawing_workspace"),
        Index("ix_chart_drawings_lookup", "user_id", "workspace", "symbol"),
        Index("ix_chart_drawings_session", "session_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    workspace: Mapped[str] = mapped_column(String(96), nullable=False)
    session_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("backtest_sessions.id", ondelete="CASCADE"))
    symbol: Mapped[str] = mapped_column(String(32), nullable=False)
    source: Mapped[str | None] = mapped_column(String(32))
    timeframe: Mapped[str | None] = mapped_column(String(8))
    tool: Mapped[str] = mapped_column(String(32), nullable=False)
    anchors: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    style: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    props: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    z_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    schema_version: Mapped[int] = mapped_column(Integer, nullable=False, default=SCHEMA_VERSION)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
