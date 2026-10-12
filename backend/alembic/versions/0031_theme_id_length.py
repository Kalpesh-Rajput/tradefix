"""Widen users.theme so luxury preset ids fit.

Revision ID: 0031
Revises: 0030
Create Date: 2026-10-12

Existing rows are not rewritten. A saved Classic, Midnight Pro, or other
preset stays as stored. Only the default for new inserts changes.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0031"
down_revision: Union[str, None] = "0030"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "users",
        "theme",
        existing_type=sa.String(length=16),
        type_=sa.String(length=32),
        existing_nullable=False,
        existing_server_default=sa.text("'dark'"),
    )
    op.alter_column(
        "users",
        "theme",
        existing_type=sa.String(length=32),
        existing_nullable=False,
        server_default="tradefix-purple",
    )


def downgrade() -> None:
    op.execute("UPDATE users SET theme = 'tradefix-purple' WHERE length(theme) > 16")
    op.alter_column(
        "users",
        "theme",
        existing_type=sa.String(length=32),
        type_=sa.String(length=16),
        existing_nullable=False,
        existing_server_default=sa.text("'tradefix-purple'"),
        server_default="dark",
    )
