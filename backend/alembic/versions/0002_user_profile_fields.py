"""user profile fields

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-02

Idempotent: skips columns/indexes that already exist (e.g. added via create_all).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_COLUMNS: list[tuple[str, sa.Column]] = [
    ("username", sa.Column("username", sa.String(64), nullable=True)),
    ("bio", sa.Column("bio", sa.Text(), nullable=True)),
    ("location", sa.Column("location", sa.String(255), nullable=True)),
    ("website_url", sa.Column("website_url", sa.String(512), nullable=True)),
    ("twitter_url", sa.Column("twitter_url", sa.String(512), nullable=True)),
    ("linkedin_url", sa.Column("linkedin_url", sa.String(512), nullable=True)),
    ("avatar_url", sa.Column("avatar_url", sa.String(1024), nullable=True)),
    (
        "public_profile",
        sa.Column("public_profile", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    ),
    (
        "show_financial_metrics",
        sa.Column(
            "show_financial_metrics", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
    ),
    (
        "show_latest_trades",
        sa.Column("show_latest_trades", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    ),
    (
        "show_pnl_chart",
        sa.Column("show_pnl_chart", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    ),
]


def _has_username_unique(bind) -> bool:
    inspector = inspect(bind)
    for uq in inspector.get_unique_constraints("users"):
        if uq.get("column_names") == ["username"]:
            return True
    for ix in inspector.get_indexes("users"):
        if ix.get("unique") and ix.get("column_names") == ["username"]:
            return True
    return False


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    existing = {col["name"] for col in inspector.get_columns("users")}

    for name, column in _COLUMNS:
        if name not in existing:
            op.add_column("users", column)

    if not _has_username_unique(bind):
        op.create_unique_constraint("uq_users_username", "users", ["username"])

    idx_names = {ix["name"] for ix in inspect(bind).get_indexes("users")}
    if "ix_users_username" not in idx_names:
        # Unique constraint may already create an index; only add non-unique lookup index if absent
        has_username_index = any(
            ix.get("column_names") == ["username"] for ix in inspect(bind).get_indexes("users")
        )
        if not has_username_index:
            op.create_index("ix_users_username", "users", ["username"])


def downgrade() -> None:
    bind = op.get_bind()
    existing = {col["name"] for col in inspect(bind).get_columns("users")}
    idx_names = {ix["name"] for ix in inspect(bind).get_indexes("users")}
    uq_names = {uq["name"] for uq in inspect(bind).get_unique_constraints("users")}

    if "ix_users_username" in idx_names:
        op.drop_index("ix_users_username", table_name="users")
    if "uq_users_username" in uq_names:
        op.drop_constraint("uq_users_username", "users", type_="unique")

    for name, _ in reversed(_COLUMNS):
        if name in existing:
            op.drop_column("users", name)
