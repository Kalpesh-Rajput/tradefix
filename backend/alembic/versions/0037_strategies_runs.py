"""Strategies and automated backtest runs (backtesting 4B).

Revision ID: 0037
Revises: 0036
Create Date: 2026-10-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0037"
down_revision: Union[str, None] = "0036"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "strategies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("definition", postgresql.JSONB(), nullable=False),
        sa.Column("schema_version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_strategies_user", "strategies", ["user_id", "updated_at"])
    op.create_table(
        "backtest_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("strategy_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("strategies.id", ondelete="SET NULL")),
        sa.Column("definition", postgresql.JSONB(), nullable=False),
        sa.Column("symbol", sa.String(32), nullable=False),
        sa.Column("timeframe", sa.String(4), nullable=False),
        sa.Column("start_ms", sa.BigInteger(), nullable=False),
        sa.Column("end_ms", sa.BigInteger(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="queued"),
        sa.Column("job_id", postgresql.UUID(as_uuid=True)),
        sa.Column("result_hash", sa.String(64)),
        sa.Column("metrics", postgresql.JSONB()),
        sa.Column("equity", postgresql.JSONB()),
        sa.Column("warnings", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("error_message", sa.Text()),
        sa.Column("bars_processed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')", name="ck_bt_run_status"),
    )
    op.create_index("ix_backtest_runs_user", "backtest_runs", ["user_id", "created_at"])
    op.create_table(
        "backtest_run_trades",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("backtest_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("side", sa.String(8), nullable=False),
        sa.Column("size", sa.Numeric(18, 6), nullable=False),
        sa.Column("entry_ms", sa.BigInteger(), nullable=False),
        sa.Column("entry_price", sa.Numeric(18, 8), nullable=False),
        sa.Column("exit_ms", sa.BigInteger(), nullable=False),
        sa.Column("exit_price", sa.Numeric(18, 8), nullable=False),
        sa.Column("sl", sa.Numeric(18, 8)),
        sa.Column("tp", sa.Numeric(18, 8)),
        sa.Column("exit_reason", sa.String(16), nullable=False),
        sa.Column("pnl", sa.Numeric(18, 4), nullable=False),
        sa.Column("pips", sa.Numeric(18, 4), nullable=False),
        sa.Column("r_multiple", sa.Numeric(18, 6)),
        sa.Column("bars_held", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("mae_pips", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("mfe_pips", sa.Numeric(18, 4), nullable=False, server_default="0"),
    )
    op.create_index("ix_backtest_run_trades_run", "backtest_run_trades", ["run_id", "seq"])


def downgrade() -> None:
    op.drop_index("ix_backtest_run_trades_run", table_name="backtest_run_trades")
    op.drop_table("backtest_run_trades")
    op.drop_index("ix_backtest_runs_user", table_name="backtest_runs")
    op.drop_table("backtest_runs")
    op.drop_index("ix_strategies_user", table_name="strategies")
    op.drop_table("strategies")
