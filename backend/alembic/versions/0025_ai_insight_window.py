"""Cache AI insight snapshots per analysis window

Revision ID: 0025
Revises: 0024
Create Date: 2026-09-23

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect, text

revision: str = "0025"
down_revision: Union[str, None] = "0024"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "ai_insight_snapshots" not in set(inspector.get_table_names()):
        return

    columns = {col["name"] for col in inspector.get_columns("ai_insight_snapshots")}
    if "window_key" not in columns:
        op.add_column(
            "ai_insight_snapshots",
            sa.Column("window_key", sa.String(length=8), nullable=False, server_default="30d"),
        )

    # Existing rows were computed on a fixed 120-day lookback. Drop them so the
    # next request rebuilds the default 30-day window instead of serving stale scope.
    op.execute("DELETE FROM ai_insight_snapshots")

    indexes = {idx["name"] for idx in inspect(bind).get_indexes("ai_insight_snapshots")}
    if "uq_ai_insight_snapshots_user_all" in indexes:
        op.drop_index("uq_ai_insight_snapshots_user_all", table_name="ai_insight_snapshots")
    if "uq_ai_insight_snapshots_user_account" in indexes:
        op.drop_index("uq_ai_insight_snapshots_user_account", table_name="ai_insight_snapshots")

    indexes = {idx["name"] for idx in inspect(bind).get_indexes("ai_insight_snapshots")}
    if "uq_ai_insight_snapshots_user_window" not in indexes:
        op.create_index(
            "uq_ai_insight_snapshots_user_window",
            "ai_insight_snapshots",
            ["user_id", "window_key"],
            unique=True,
            postgresql_where=text("account_id IS NULL"),
        )
    if "uq_ai_insight_snapshots_user_account_window" not in indexes:
        op.create_index(
            "uq_ai_insight_snapshots_user_account_window",
            "ai_insight_snapshots",
            ["user_id", "account_id", "window_key"],
            unique=True,
            postgresql_where=text("account_id IS NOT NULL"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "ai_insight_snapshots" not in set(inspector.get_table_names()):
        return

    op.execute("DELETE FROM ai_insight_snapshots")
    indexes = {idx["name"] for idx in inspector.get_indexes("ai_insight_snapshots")}
    if "uq_ai_insight_snapshots_user_account_window" in indexes:
        op.drop_index("uq_ai_insight_snapshots_user_account_window", table_name="ai_insight_snapshots")
    if "uq_ai_insight_snapshots_user_window" in indexes:
        op.drop_index("uq_ai_insight_snapshots_user_window", table_name="ai_insight_snapshots")

    indexes = {idx["name"] for idx in inspect(bind).get_indexes("ai_insight_snapshots")}
    if "uq_ai_insight_snapshots_user_all" not in indexes:
        op.create_index(
            "uq_ai_insight_snapshots_user_all",
            "ai_insight_snapshots",
            ["user_id"],
            unique=True,
            postgresql_where=text("account_id IS NULL"),
        )
    if "uq_ai_insight_snapshots_user_account" not in indexes:
        op.create_index(
            "uq_ai_insight_snapshots_user_account",
            "ai_insight_snapshots",
            ["user_id", "account_id"],
            unique=True,
            postgresql_where=text("account_id IS NOT NULL"),
        )

    columns = {col["name"] for col in inspect(bind).get_columns("ai_insight_snapshots")}
    if "window_key" in columns:
        op.drop_column("ai_insight_snapshots", "window_key")
