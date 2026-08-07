"""user goals fields

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-04

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_COLUMNS: list[tuple[str, sa.Column]] = [
    ("weekly_goal", sa.Column("weekly_goal", sa.Numeric(18, 2), nullable=True)),
    ("monthly_goal", sa.Column("monthly_goal", sa.Numeric(18, 2), nullable=True)),
    ("yearly_goal", sa.Column("yearly_goal", sa.Numeric(18, 2), nullable=True)),
    ("target_trades", sa.Column("target_trades", sa.Integer(), nullable=True)),
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
