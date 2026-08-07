"""user appearance preferences

Revision ID: 0007
Revises: 0006
Create Date: 2026-08-04

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_COLUMNS: list[tuple[str, sa.Column]] = [
    (
        "theme",
        sa.Column("theme", sa.String(16), nullable=False, server_default="dark"),
    ),
    (
        "accent_color",
        sa.Column("accent_color", sa.String(32), nullable=False, server_default="teal"),
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
