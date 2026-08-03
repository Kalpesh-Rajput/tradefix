import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    username: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    website_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    twitter_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    public_profile: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    show_financial_metrics: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    show_latest_trades: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    show_pnl_chart: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="UTC", server_default="UTC")
    language: Mapped[str] = mapped_column(String(16), nullable=False, default="en", server_default="en")
    date_format: Mapped[str] = mapped_column(
        String(32), nullable=False, default="MM/DD/YYYY", server_default="MM/DD/YYYY"
    )
    save_filters: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    journal_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    accounts: Mapped[list["Account"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    trades: Mapped[list["Trade"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    watchlist_items: Mapped[list["WatchlistItem"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    mood_checkins: Mapped[list["MoodCheckin"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    insights: Mapped[list["Insight"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    agent_runs: Mapped[list["AgentRun"]] = relationship(back_populates="user", cascade="all, delete-orphan")
