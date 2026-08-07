"""account portfolio fields

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-04

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect, text

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_COLUMNS: list[tuple[str, sa.Column]] = [
    ("description", sa.Column("description", sa.Text(), nullable=True)),
    (
        "initial_balance",
        sa.Column("initial_balance", sa.Numeric(18, 2), nullable=False, server_default="10000"),
    ),
    (
        "pnl_display_mode",
        sa.Column("pnl_display_mode", sa.String(16), nullable=False, server_default="net"),
    ),
    (
        "default_fee_per_trade",
        sa.Column("default_fee_per_trade", sa.Numeric(18, 4), nullable=False, server_default="0"),
    ),
    (
        "is_default",
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    ),
]


def upgrade() -> None:
    bind = op.get_bind()
    existing = {col["name"] for col in inspect(bind).get_columns("accounts")}
    for name, column in _COLUMNS:
        if name not in existing:
            op.add_column("accounts", column)

    # Mark the oldest account per user as default when none is set
    bind.execute(
        text(
            """
            UPDATE accounts AS a
            SET is_default = true
            WHERE a.id IN (
                SELECT DISTINCT ON (user_id) id
                FROM accounts
                ORDER BY user_id, created_at ASC
            )
            AND NOT EXISTS (
                SELECT 1 FROM accounts b
                WHERE b.user_id = a.user_id AND b.is_default = true
            )
            """
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    existing = {col["name"] for col in inspect(bind).get_columns("accounts")}
    for name, _ in reversed(_COLUMNS):
        if name in existing:
            op.drop_column("accounts", name)
