"""daily P&L goal + monthly goal prompt ack

Revision ID: 0019
Revises: 0018
Create Date: 2026-09-15

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "0019"
down_revision: Union[str, None] = "0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_COLUMNS: list[tuple[str, sa.Column]] = [
    ("daily_goal", sa.Column("daily_goal", sa.Numeric(18, 2), nullable=True)),
    (
        "monthly_goal_ack_month",
        sa.Column("monthly_goal_ack_month", sa.String(7), nullable=True),
    ),
]


def upgrade() -> None:
    bind = op.get_bind()
    existing = {col["name"] for col in inspect(bind).get_columns("users")}
    for name, column in _COLUMNS:
        if name not in existing:
            op.add_column("users", column)


def downgrade() -> None:
    bind = op.get_bind()
    existing = {col["name"] for col in inspect(bind).get_columns("users")}
    for name, _ in reversed(_COLUMNS):
        if name in existing:
            op.drop_column("users", name)
