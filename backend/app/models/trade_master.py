import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class MasterCategory(str, enum.Enum):
    symbol = "symbol"
    entry_condition = "entry_condition"
    exit_condition = "exit_condition"
    timeframe = "timeframe"
    session = "session"
    trade_type = "trade_type"
    mood = "mood"
    strategy = "strategy"


class TradeMaster(Base):
    __tablename__ = "trade_masters"
    __table_args__ = (
        UniqueConstraint("user_id", "category", "name", name="uq_trade_masters_user_category_name"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category: Mapped[MasterCategory] = mapped_column(
        Enum(MasterCategory, name="master_category", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    is_builtin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="trade_masters")
