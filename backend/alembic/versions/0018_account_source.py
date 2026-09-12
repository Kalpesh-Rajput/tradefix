"""account source + broker link

Revision ID: 0018
Revises: 0017
Create Date: 2026-09-12

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "0018"
down_revision: Union[str, None] = "0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_COLUMNS: list[tuple[str, sa.Column]] = [
    (
        "source",
        sa.Column("source", sa.String(16), nullable=False, server_default="dummy"),
    ),
    ("broker_id", sa.Column("broker_id", sa.String(64), nullable=True)),
    ("broker_name", sa.Column("broker_name", sa.String(255), nullable=True)),
]


def upgrade() -> None:
    bind = op.get_bind()
    existing = {col["name"] for col in inspect(bind).get_columns("accounts")}
    for name, column in _COLUMNS:
        if name not in existing:
            op.add_column("accounts", column)


def downgrade() -> None:
    bind = op.get_bind()
    existing = {col["name"] for col in inspect(bind).get_columns("accounts")}
    for name, _ in reversed(_COLUMNS):
        if name in existing:
            op.drop_column("accounts", name)
