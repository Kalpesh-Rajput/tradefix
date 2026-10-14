"""Market data foundation: instruments, aliases, coverage, jobs, simulated/time-basis trade columns.

Revision ID: 0033
Revises: 0032
Create Date: 2026-10-14

Candles are stored as Parquet outside the database; these tables are metadata only.
trades.time_basis is backfilled from trades.source (see backtesting/AUDIT.md section 3).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0033"
down_revision: Union[str, None] = "0032"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

MT_SOURCES = ("api:mt4", "api:mt5", "api:xm", "api:exness", "api:avatrade")


def upgrade() -> None:
    op.create_table(
        "instruments",
        sa.Column("symbol", sa.String(32), primary_key=True),
        sa.Column("asset_class", sa.String(16), nullable=False),
        sa.Column("source", sa.String(16), nullable=False),
        sa.Column("provider_id", sa.String(64), nullable=False),
        sa.Column("market_type", sa.String(16), nullable=False, server_default="spot"),
        sa.Column("pip_size", sa.Float(), nullable=False),
        sa.Column("contract_size", sa.Float(), nullable=False),
        sa.Column("quote_currency", sa.String(8), nullable=False),
        sa.Column("price_decimals", sa.Integer(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("preload_years", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("verified_on", sa.Date(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_instruments_asset_class", "instruments", ["asset_class"])

    op.create_table(
        "symbol_aliases",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("broker", sa.String(64), nullable=False),
        sa.Column("raw_symbol", sa.String(64), nullable=False),
        sa.Column("canonical_symbol", sa.String(32), sa.ForeignKey("instruments.symbol", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", sa.String(120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("broker", "raw_symbol", name="uq_symbol_alias_broker_raw"),
    )

    op.create_table(
        "unresolved_symbols",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("broker", sa.String(64), nullable=False),
        sa.Column("raw_symbol", sa.String(64), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("interest_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("first_seen", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("last_seen", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("broker", "raw_symbol", name="uq_unresolved_broker_raw"),
    )

    op.create_table(
        "candle_coverage",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("instrument", sa.String(32), sa.ForeignKey("instruments.symbol", ondelete="CASCADE"), nullable=False),
        sa.Column("source", sa.String(16), nullable=False),
        sa.Column("covered_from", sa.BigInteger(), nullable=False),
        sa.Column("covered_to", sa.BigInteger(), nullable=False),
        sa.Column("row_count", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("covered_to > covered_from", name="ck_coverage_range"),
    )
    op.create_index("ix_candle_coverage_instrument", "candle_coverage", ["instrument", "source", "covered_from"])

    op.create_table(
        "candle_month_stats",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("instrument", sa.String(32), sa.ForeignKey("instruments.symbol", ondelete="CASCADE"), nullable=False),
        sa.Column("source", sa.String(16), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("row_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("gap_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("outliers", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("detail", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("instrument", "source", "year", "month", name="uq_candle_month"),
    )

    op.create_table(
        "jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("type", sa.String(32), nullable=False),
        sa.Column("lane", sa.String(16), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="queued"),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("dedup_key", sa.String(200), nullable=True),
        sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("progress_message", sa.String(300), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("next_run_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("locked_by", sa.String(120), nullable=True),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancel_requested", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("error_code", sa.String(64), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("result", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')", name="ck_jobs_status"
        ),
    )
    op.create_index(
        "uq_jobs_active_dedup",
        "jobs",
        ["dedup_key"],
        unique=True,
        postgresql_where=sa.text("status IN ('queued', 'running') AND dedup_key IS NOT NULL"),
    )
    op.create_index("ix_jobs_runnable", "jobs", ["status", "next_run_at"])
    op.create_index("ix_jobs_owner_created", "jobs", ["owner_user_id", "created_at"])

    op.create_table(
        "worker_heartbeats",
        sa.Column("name", sa.String(64), primary_key=True),
        sa.Column("instance", sa.String(120), nullable=False),
        sa.Column("last_seen", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("info", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )

    op.add_column("trades", sa.Column("is_simulated", sa.Boolean(), nullable=False, server_default="false"))
    op.create_index("ix_trades_is_simulated", "trades", ["is_simulated"])
    op.add_column("trades", sa.Column("time_basis", sa.String(24), nullable=False, server_default="unknown"))
    mt_list = ", ".join(f"'{s}'" for s in MT_SOURCES)
    op.execute(
        f"""
        UPDATE trades SET time_basis = CASE
            WHEN source = 'manual' THEN 'utc_aware'
            WHEN source IN ({mt_list}) THEN 'naive_wall_clock'
            WHEN source LIKE 'api:%' THEN 'utc_aware'
            ELSE 'unknown'
        END
        """
    )


def downgrade() -> None:
    op.drop_column("trades", "time_basis")
    op.drop_index("ix_trades_is_simulated", table_name="trades")
    op.drop_column("trades", "is_simulated")
    op.drop_table("worker_heartbeats")
    op.drop_index("ix_jobs_owner_created", table_name="jobs")
    op.drop_index("ix_jobs_runnable", table_name="jobs")
    op.drop_index("uq_jobs_active_dedup", table_name="jobs")
    op.drop_table("jobs")
    op.drop_table("candle_month_stats")
    op.drop_index("ix_candle_coverage_instrument", table_name="candle_coverage")
    op.drop_table("candle_coverage")
    op.drop_table("unresolved_symbols")
    op.drop_table("symbol_aliases")
    op.drop_index("ix_instruments_asset_class", table_name="instruments")
    op.drop_table("instruments")
