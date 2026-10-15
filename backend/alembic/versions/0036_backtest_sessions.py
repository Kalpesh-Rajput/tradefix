"""Manual backtesting sessions (backtesting 3C).

Revision ID: 0036
Revises: 0035
Create Date: 2026-10-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0036"
down_revision: Union[str, None] = "0035"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "backtest_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("accounts.id", ondelete="SET NULL")),
        sa.Column("symbol", sa.String(32), nullable=False),
        sa.Column("timeframe", sa.String(4), nullable=False),
        sa.Column("start_ms", sa.BigInteger(), nullable=False),
        sa.Column("end_ms", sa.BigInteger()),
        sa.Column("cursor_ms", sa.BigInteger(), nullable=False),
        sa.Column("initial_balance", sa.Numeric(18, 2), nullable=False),
        sa.Column("currency", sa.String(8), nullable=False),
        sa.Column("spread_pips", sa.Numeric(12, 4), nullable=False, server_default="0"),
        sa.Column("commission_per_lot", sa.Numeric(12, 4), nullable=False, server_default="0"),
        sa.Column("status", sa.String(16), nullable=False, server_default="active"),
        sa.Column("notes", sa.Text()),
        sa.Column("warnings", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('active', 'finished')", name="ck_bt_session_status"),
        sa.CheckConstraint("initial_balance > 0", name="ck_bt_session_balance"),
    )
    op.create_index("ix_backtest_sessions_user", "backtest_sessions", ["user_id", "updated_at"])
    op.create_table(
        "session_orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("backtest_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("side", sa.String(8), nullable=False),
        sa.Column("order_type", sa.String(8), nullable=False),
        sa.Column("size", sa.Numeric(18, 6), nullable=False),
        sa.Column("price", sa.Numeric(18, 8)),
        sa.Column("sl", sa.Numeric(18, 8)),
        sa.Column("tp", sa.Numeric(18, 8)),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("created_ms", sa.BigInteger(), nullable=False),
        sa.Column("filled_ms", sa.BigInteger()),
        sa.CheckConstraint("side IN ('buy', 'sell')", name="ck_session_order_side"),
        sa.CheckConstraint("order_type IN ('market', 'limit', 'stop')", name="ck_session_order_type"),
        sa.CheckConstraint("status IN ('pending', 'filled', 'cancelled', 'rejected')", name="ck_session_order_status"),
    )
    op.create_index("ix_session_orders_session", "session_orders", ["session_id"])
    op.create_table(
        "session_trades",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("backtest_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("side", sa.String(8), nullable=False),
        sa.Column("size", sa.Numeric(18, 6), nullable=False),
        sa.Column("entry_ms", sa.BigInteger(), nullable=False),
        sa.Column("entry_price", sa.Numeric(18, 8), nullable=False),
        sa.Column("exit_ms", sa.BigInteger(), nullable=False),
        sa.Column("exit_price", sa.Numeric(18, 8), nullable=False),
        sa.Column("sl", sa.Numeric(18, 8)),
        sa.Column("tp", sa.Numeric(18, 8)),
        sa.Column("exit_reason", sa.String(16), nullable=False),
        sa.Column("commission", sa.Numeric(18, 4), nullable=False),
        sa.Column("pnl", sa.Numeric(18, 4), nullable=False),
        sa.Column("pips", sa.Numeric(18, 4), nullable=False),
        sa.Column("r_multiple", sa.Numeric(18, 6)),
        sa.Column("pnl_currency", sa.String(8), nullable=False),
        sa.Column("client_pnl", sa.Numeric(18, 4)),
        sa.Column("discrepancy", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("notes", sa.Text()),
        sa.CheckConstraint("side IN ('buy', 'sell')", name="ck_session_trade_side"),
        sa.CheckConstraint("exit_reason IN ('tp', 'sl', 'manual', 'session end')", name="ck_session_trade_reason"),
    )
    op.create_index("ix_session_trades_session", "session_trades", ["session_id"])
    op.create_table(
        "usage_counters",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("day", sa.Date(), primary_key=True),
        sa.Column("backtest_runs", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("manual_sessions", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_table("usage_counters")
    op.drop_index("ix_session_trades_session", table_name="session_trades")
    op.drop_table("session_trades")
    op.drop_index("ix_session_orders_session", table_name="session_orders")
    op.drop_table("session_orders")
    op.drop_index("ix_backtest_sessions_user", table_name="backtest_sessions")
    op.drop_table("backtest_sessions")
