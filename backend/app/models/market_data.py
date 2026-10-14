"""Market-data metadata: instrument registry mirror, symbol aliases, coverage. Candles live in Parquet."""

import uuid
from datetime import date, datetime

from sqlalchemy import BigInteger, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Instrument(Base):
    __tablename__ = "instruments"

    symbol: Mapped[str] = mapped_column(String(32), primary_key=True)
    asset_class: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(16), nullable=False)
    provider_id: Mapped[str] = mapped_column(String(64), nullable=False)
    market_type: Mapped[str] = mapped_column(String(16), nullable=False, default="spot")
    pip_size: Mapped[float] = mapped_column(Float, nullable=False)
    contract_size: Mapped[float] = mapped_column(Float, nullable=False)
    quote_currency: Mapped[str] = mapped_column(String(8), nullable=False)
    price_decimals: Mapped[int] = mapped_column(Integer, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    preload_years: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    verified_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class SymbolAlias(Base):
    __tablename__ = "symbol_aliases"
    __table_args__ = (UniqueConstraint("broker", "raw_symbol", name="uq_symbol_alias_broker_raw"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    broker: Mapped[str] = mapped_column(String(64), nullable=False)
    raw_symbol: Mapped[str] = mapped_column(String(64), nullable=False)
    canonical_symbol: Mapped[str] = mapped_column(String(32), ForeignKey("instruments.symbol", ondelete="CASCADE"), nullable=False)
    created_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UnresolvedSymbol(Base):
    __tablename__ = "unresolved_symbols"
    __table_args__ = (UniqueConstraint("broker", "raw_symbol", name="uq_unresolved_broker_raw"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    broker: Mapped[str] = mapped_column(String(64), nullable=False)
    raw_symbol: Mapped[str] = mapped_column(String(64), nullable=False)
    count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    interest_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CandleCoverage(Base):
    __tablename__ = "candle_coverage"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    instrument: Mapped[str] = mapped_column(
        String(32), ForeignKey("instruments.symbol", ondelete="CASCADE"), nullable=False, index=True
    )
    source: Mapped[str] = mapped_column(String(16), nullable=False)
    covered_from: Mapped[int] = mapped_column(BigInteger, nullable=False)
    covered_to: Mapped[int] = mapped_column(BigInteger, nullable=False)
    row_count: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CandleMonthStat(Base):
    """Per instrument-month quality summary written after each store write (gap summary for data status)."""

    __tablename__ = "candle_month_stats"
    __table_args__ = (UniqueConstraint("instrument", "source", "year", "month", name="uq_candle_month"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    instrument: Mapped[str] = mapped_column(String(32), ForeignKey("instruments.symbol", ondelete="CASCADE"), nullable=False)
    source: Mapped[str] = mapped_column(String(16), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    row_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    gap_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    outliers: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    detail: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
