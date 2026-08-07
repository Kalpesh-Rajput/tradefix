"""Wave 0.5 + Wave 1: trade journaling depth, daily check-ins, billing plan

Revision ID: 0009
Revises: 0008
Create Date: 2026-08-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TRADE_COLUMNS: list[tuple[str, sa.Column]] = [
    ("setup_tags", sa.Column("setup_tags", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb"))),
    ("emotion_tags", sa.Column("emotion_tags", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb"))),
    ("plan_compliance", sa.Column("plan_compliance", sa.Integer(), nullable=True)),
    ("risk_amount", sa.Column("risk_amount", sa.Numeric(18, 2), nullable=True)),
    ("screenshot_urls", sa.Column("screenshot_urls", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb"))),
    ("score_preparation", sa.Column("score_preparation", sa.Integer(), nullable=True)),
    ("score_risk", sa.Column("score_risk", sa.Integer(), nullable=True)),
    ("score_entry", sa.Column("score_entry", sa.Integer(), nullable=True)),
    ("score_exit", sa.Column("score_exit", sa.Integer(), nullable=True)),
    ("score_discipline", sa.Column("score_discipline", sa.Integer(), nullable=True)),
    ("score_psychology", sa.Column("score_psychology", sa.Integer(), nullable=True)),
    ("voice_url", sa.Column("voice_url", sa.String(1024), nullable=True)),
    ("voice_transcript", sa.Column("voice_transcript", sa.Text(), nullable=True)),
    ("auto_flags", sa.Column("auto_flags", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb"))),
]

_USER_COLUMNS: list[tuple[str, sa.Column]] = [
    ("plan", sa.Column("plan", sa.String(16), nullable=False, server_default="free")),
    ("stripe_customer_id", sa.Column("stripe_customer_id", sa.String(255), nullable=True)),
    ("custom_emotion_tags", sa.Column("custom_emotion_tags", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb"))),
    ("emotion_tag_order", sa.Column("emotion_tag_order", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb"))),
    ("role", sa.Column("role", sa.String(16), nullable=False, server_default="trader")),
]


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    trade_cols = {c["name"] for c in inspector.get_columns("trades")}
    for name, column in _TRADE_COLUMNS:
        if name not in trade_cols:
            op.add_column("trades", column)

    # Backfill setup_tags from setup_tag
    op.execute(
        """
        UPDATE trades
        SET setup_tags = CASE
            WHEN setup_tag IS NOT NULL AND setup_tag <> '' THEN jsonb_build_array(setup_tag)
            ELSE '[]'::jsonb
        END
        WHERE setup_tags = '[]'::jsonb AND setup_tag IS NOT NULL AND setup_tag <> ''
        """
    )

    user_cols = {c["name"] for c in inspector.get_columns("users")}
    for name, column in _USER_COLUMNS:
        if name not in user_cols:
            op.add_column("users", column)

    tables = set(inspector.get_table_names())
    if "daily_checkins" not in tables:
        op.create_table(
            "daily_checkins",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=True),
            sa.Column("date", sa.Date(), nullable=False),
            sa.Column("max_loss", sa.Numeric(18, 2), nullable=True),
            sa.Column("max_trades", sa.Integer(), nullable=True),
            sa.Column("focus_setup", sa.String(100), nullable=True),
            sa.Column("goal_note", sa.Text(), nullable=True),
            sa.Column("followed", sa.String(16), nullable=True),
            sa.Column("evening_note", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.UniqueConstraint("user_id", "date", name="uq_daily_checkins_user_date"),
        )
        op.create_index("ix_daily_checkins_user_id", "daily_checkins", ["user_id"])
        op.create_index("ix_daily_checkins_date", "daily_checkins", ["date"])

    if "prop_settings" not in tables:
        op.create_table(
            "prop_settings",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
            sa.Column("profile", sa.String(32), nullable=False, server_default="custom"),
            sa.Column("max_daily_loss_pct", sa.Numeric(8, 2), nullable=False, server_default="5"),
            sa.Column("max_overall_drawdown_pct", sa.Numeric(8, 2), nullable=False, server_default="10"),
            sa.Column("consistency_rule_pct", sa.Numeric(8, 2), nullable=True),
            sa.Column("min_trading_days", sa.Integer(), nullable=True),
            sa.Column("warn_threshold_pct", sa.Numeric(8, 2), nullable=False, server_default="80"),
            sa.Column("danger_threshold_pct", sa.Numeric(8, 2), nullable=False, server_default="90"),
            sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.UniqueConstraint("user_id", "account_id", name="uq_prop_settings_user_account"),
        )
        op.create_index("ix_prop_settings_user_id", "prop_settings", ["user_id"])

    if "mentor_access" not in tables:
        op.create_table(
            "mentor_access",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("trader_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("coach_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.UniqueConstraint("trader_id", "coach_id", name="uq_mentor_access_pair"),
        )

    if "trade_comments" not in tables:
        op.create_table(
            "trade_comments",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("trade_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("trades.id", ondelete="CASCADE"), nullable=False),
            sa.Column("author_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("body", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        )
        op.create_index("ix_trade_comments_trade_id", "trade_comments", ["trade_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())
    if "trade_comments" in tables:
        op.drop_table("trade_comments")
    if "mentor_access" in tables:
        op.drop_table("mentor_access")
    if "prop_settings" in tables:
        op.drop_table("prop_settings")
    if "daily_checkins" in tables:
        op.drop_table("daily_checkins")

    user_cols = {c["name"] for c in inspector.get_columns("users")}
    for name, _ in reversed(_USER_COLUMNS):
        if name in user_cols:
            op.drop_column("users", name)

    trade_cols = {c["name"] for c in inspector.get_columns("trades")}
    for name, _ in reversed(_TRADE_COLUMNS):
        if name in trade_cols:
            op.drop_column("trades", name)
