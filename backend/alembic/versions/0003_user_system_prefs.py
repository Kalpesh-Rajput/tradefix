"""user system preferences

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-02

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_COLUMNS: list[tuple[str, sa.Column]] = [
    ("timezone", sa.Column("timezone", sa.String(64), nullable=False, server_default="UTC")),
    ("language", sa.Column("language", sa.String(16), nullable=False, server_default="en")),
    (
        "date_format",
        sa.Column("date_format", sa.String(32), nullable=False, server_default="MM/DD/YYYY"),
    ),
    (
        "save_filters",
        sa.Column("save_filters", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    ),
    ("journal_template", sa.Column("journal_template", sa.Text(), nullable=True)),
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
