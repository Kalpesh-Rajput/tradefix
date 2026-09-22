"""Proactive TradeFix AI insight snapshots

Revision ID: 0024
Revises: 0023
Create Date: 2026-09-22

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect, text
from sqlalchemy.dialects import postgresql

revision: str = "0024"
down_revision: Union[str, None] = "0023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())
    if "ai_insight_snapshots" in tables:
        return

    op.create_table(
        "ai_insight_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("accounts.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("trades_analysed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("latest_trade_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
    )
    op.create_index("ix_ai_insight_snapshots_user_id", "ai_insight_snapshots", ["user_id"])
    op.create_index(
        "uq_ai_insight_snapshots_user_all",
        "ai_insight_snapshots",
        ["user_id"],
        unique=True,
        postgresql_where=text("account_id IS NULL"),
    )
    op.create_index(
        "uq_ai_insight_snapshots_user_account",
        "ai_insight_snapshots",
        ["user_id", "account_id"],
        unique=True,
        postgresql_where=text("account_id IS NOT NULL"),
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "ai_insight_snapshots" not in set(inspector.get_table_names()):
        return
    op.drop_index("uq_ai_insight_snapshots_user_account", table_name="ai_insight_snapshots")
    op.drop_index("uq_ai_insight_snapshots_user_all", table_name="ai_insight_snapshots")
    op.drop_index("ix_ai_insight_snapshots_user_id", table_name="ai_insight_snapshots")
    op.drop_table("ai_insight_snapshots")
