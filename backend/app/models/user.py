import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    google_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    auth_provider: Mapped[str] = mapped_column(
        String(32), nullable=False, default="email", server_default="email"
    )
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
    default_symbol: Mapped[str | None] = mapped_column(String(32), nullable=True)
    default_quantity: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    default_fee: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    default_forex_leverage: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    default_strategies: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    custom_strategies: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    strategy_order: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    custom_mistakes: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    mistake_order: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    weekly_goal: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    monthly_goal: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    yearly_goal: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    target_trades: Mapped[int | None] = mapped_column(Integer, nullable=True)
    theme: Mapped[str] = mapped_column(String(16), nullable=False, default="dark", server_default="dark")
    accent_color: Mapped[str] = mapped_column(String(32), nullable=False, default="purple", server_default="purple")
    plan: Mapped[str] = mapped_column(String(16), nullable=False, default="free", server_default="free")
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    custom_emotion_tags: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    emotion_tag_order: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    role: Mapped[str] = mapped_column(String(16), nullable=False, default="trader", server_default="trader")
    onboarding_step: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    trading_experience: Mapped[str | None] = mapped_column(String(32), nullable=True)
    capital_sources: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    primary_broker: Mapped[str | None] = mapped_column(String(128), nullable=True)
    markets_traded: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    onboarding_goals: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    referral_source: Mapped[str | None] = mapped_column(String(64), nullable=True)
    referral_detail: Mapped[str | None] = mapped_column(String(255), nullable=True)
    onboarding_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    accounts: Mapped[list["Account"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    trades: Mapped[list["Trade"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    watchlist_items: Mapped[list["WatchlistItem"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    mood_checkins: Mapped[list["MoodCheckin"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    daily_recaps: Mapped[list["DailyRecap"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    daily_checkins: Mapped[list["DailyCheckin"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    prop_settings: Mapped[list["PropSettings"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    insights: Mapped[list["Insight"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    agent_runs: Mapped[list["AgentRun"]] = relationship(back_populates="user", cascade="all, delete-orphan")
