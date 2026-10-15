"""Backtesting user data. Nothing here is ever joined into live trades or live analytics."""

import uuid
from datetime import date, datetime

from sqlalchemy import BigInteger, Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base

NOTE_MAX_LENGTH = 2000


class TradeReplayNote(Base):
    __tablename__ = "trade_replay_notes"
    __table_args__ = (
        CheckConstraint(f"char_length(text) BETWEEN 1 AND {NOTE_MAX_LENGTH}", name="ck_replay_note_text"),
        Index("ix_trade_replay_notes_user_trade", "user_id", "trade_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    trade_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("trades.id", ondelete="CASCADE"), nullable=False)
    replay_time_ms: Mapped[int] = mapped_column(BigInteger, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BacktestSession(Base):
    __tablename__ = "backtest_sessions"
    __table_args__ = (
        CheckConstraint("status IN ('active', 'finished')", name="ck_bt_session_status"),
        CheckConstraint("initial_balance > 0", name="ck_bt_session_balance"),
        Index("ix_backtest_sessions_user", "user_id", "updated_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    account_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="SET NULL"))
    symbol: Mapped[str] = mapped_column(String(32), nullable=False)
    timeframe: Mapped[str] = mapped_column(String(4), nullable=False)
    start_ms: Mapped[int] = mapped_column(BigInteger, nullable=False)
    end_ms: Mapped[int | None] = mapped_column(BigInteger)
    cursor_ms: Mapped[int] = mapped_column(BigInteger, nullable=False)
    initial_balance: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="USD")
    spread_pips: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False, default=0)
    commission_per_lot: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")
    notes: Mapped[str | None] = mapped_column(Text)
    warnings: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class SessionOrder(Base):
    __tablename__ = "session_orders"
    __table_args__ = (
        CheckConstraint("side IN ('buy', 'sell')", name="ck_session_order_side"),
        CheckConstraint("order_type IN ('market', 'limit', 'stop')", name="ck_session_order_type"),
        CheckConstraint("status IN ('pending', 'filled', 'cancelled', 'rejected')", name="ck_session_order_status"),
        Index("ix_session_orders_session", "session_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("backtest_sessions.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    side: Mapped[str] = mapped_column(String(8), nullable=False)
    order_type: Mapped[str] = mapped_column(String(8), nullable=False)
    size: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    price: Mapped[float | None] = mapped_column(Numeric(18, 8))
    sl: Mapped[float | None] = mapped_column(Numeric(18, 8))
    tp: Mapped[float | None] = mapped_column(Numeric(18, 8))
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    created_ms: Mapped[int] = mapped_column(BigInteger, nullable=False)
    filled_ms: Mapped[int | None] = mapped_column(BigInteger)


class SessionTrade(Base):
    __tablename__ = "session_trades"
    __table_args__ = (
        CheckConstraint("side IN ('buy', 'sell')", name="ck_session_trade_side"),
        CheckConstraint("exit_reason IN ('tp', 'sl', 'manual', 'session end')", name="ck_session_trade_reason"),
        Index("ix_session_trades_session", "session_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("backtest_sessions.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    side: Mapped[str] = mapped_column(String(8), nullable=False)
    size: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    entry_ms: Mapped[int] = mapped_column(BigInteger, nullable=False)
    entry_price: Mapped[float] = mapped_column(Numeric(18, 8), nullable=False)
    exit_ms: Mapped[int] = mapped_column(BigInteger, nullable=False)
    exit_price: Mapped[float] = mapped_column(Numeric(18, 8), nullable=False)
    sl: Mapped[float | None] = mapped_column(Numeric(18, 8))
    tp: Mapped[float | None] = mapped_column(Numeric(18, 8))
    exit_reason: Mapped[str] = mapped_column(String(16), nullable=False)
    commission: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    pnl: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    pips: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    r_multiple: Mapped[float | None] = mapped_column(Numeric(18, 6))
    pnl_currency: Mapped[str] = mapped_column(String(8), nullable=False)
    client_pnl: Mapped[float | None] = mapped_column(Numeric(18, 4))
    discrepancy: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    notes: Mapped[str | None] = mapped_column(Text)


class UsageCounter(Base):
    __tablename__ = "usage_counters"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    backtest_runs: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    manual_sessions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
