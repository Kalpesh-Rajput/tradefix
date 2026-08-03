"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-07-31

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # create_type=False: enums are created explicitly below; otherwise create_table
    # tries to CREATE TYPE again and fails with DuplicateObject.
    asset_type = postgresql.ENUM(
        "stock", "option", "future", "forex", "crypto", name="asset_type", create_type=False
    )
    trade_side = postgresql.ENUM("long", "short", name="trade_side", create_type=False)
    trade_status = postgresql.ENUM("open", "closed", name="trade_status", create_type=False)
    insight_type = postgresql.ENUM(
        "TIME_EDGE", "STREAK_ALERT", "SETUP_WIN", "SETUP_DECAY", "MORNING_BRIEF",
        "PATTERN_SCOUT", "RISK_CONTRIBUTION", "HOT_TAKE", "JOURNAL_PULSE",
        name="insight_type",
        create_type=False,
    )
    insight_severity = postgresql.ENUM(
        "info", "warning", "critical", "positive", name="insight_severity", create_type=False
    )
    agent_run_status = postgresql.ENUM(
        "success", "skipped", "failed", name="agent_run_status", create_type=False
    )

    bind = op.get_bind()
    for enum in (asset_type, trade_side, trade_status, insight_type, insight_severity, agent_run_status):
        enum.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False, server_default="Main Account"),
        sa.Column("base_currency", sa.String(10), nullable=False, server_default="USD"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "trades",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("accounts.id"), nullable=False),
        sa.Column("symbol", sa.String(32), nullable=False),
        sa.Column("asset_type", asset_type, nullable=False, server_default="stock"),
        sa.Column("side", trade_side, nullable=False, server_default="long"),
        sa.Column("quantity", sa.Numeric(18, 6), nullable=False),
        sa.Column("entry_price", sa.Numeric(18, 6), nullable=False),
        sa.Column("exit_price", sa.Numeric(18, 6), nullable=True),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("pnl", sa.Numeric(18, 2), nullable=True),
        sa.Column("fees", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("setup_tag", sa.String(100), nullable=True),
        sa.Column("mood", sa.String(50), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("rules_broken", postgresql.ARRAY(sa.String()), nullable=False, server_default="{}"),
        sa.Column("status", trade_status, nullable=False, server_default="closed"),
        sa.Column("extra", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_trades_user_id", "trades", ["user_id"])
    op.create_index("ix_trades_symbol", "trades", ["symbol"])
    op.create_index("ix_trades_opened_at", "trades", ["opened_at"])
    op.create_index("ix_trades_closed_at", "trades", ["closed_at"])
    op.create_index("ix_trades_setup_tag", "trades", ["setup_tag"])
    op.create_index("ix_trades_status", "trades", ["status"])

    op.create_table(
        "watchlist_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("symbol", sa.String(32), nullable=False),
        sa.Column("notes", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_watchlist_items_user_id", "watchlist_items", ["user_id"])

    op.create_table(
        "mood_checkins",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("mood_score", sa.Integer(), nullable=False),
        sa.Column("notes", sa.String(1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_mood_checkins_user_id", "mood_checkins", ["user_id"])
    op.create_index("ix_mood_checkins_date", "mood_checkins", ["date"])

    op.create_table(
        "insights",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("agent_name", sa.String(50), nullable=True),
        sa.Column("type", insight_type, nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("severity", insight_severity, nullable=False, server_default="info"),
        sa.Column("data", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("dismissed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_insights_user_id", "insights", ["user_id"])
    op.create_index("ix_insights_agent_name", "insights", ["agent_name"])
    op.create_index("ix_insights_type", "insights", ["type"])
    op.create_index("ix_insights_created_at", "insights", ["created_at"])

    op.create_table(
        "agent_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("agent_name", sa.String(50), nullable=False),
        sa.Column("status", agent_run_status, nullable=False, server_default="success"),
        sa.Column("message", sa.String(1000), nullable=True),
        sa.Column("insight_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("insights.id"), nullable=True),
        sa.Column("run_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_agent_runs_user_id", "agent_runs", ["user_id"])
    op.create_index("ix_agent_runs_agent_name", "agent_runs", ["agent_name"])


def downgrade() -> None:
    op.drop_table("agent_runs")
    op.drop_table("insights")
    op.drop_table("mood_checkins")
    op.drop_table("watchlist_items")
    op.drop_table("trades")
    op.drop_table("accounts")
    op.drop_table("users")

    bind = op.get_bind()
    for name in ("agent_run_status", "insight_severity", "insight_type", "trade_status", "trade_side", "asset_type"):
        postgresql.ENUM(name=name).drop(bind, checkfirst=True)
