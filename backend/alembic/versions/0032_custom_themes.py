"""Store per-user custom theme palettes outside the short theme column.

Revision ID: 0032
Revises: 0031
Create Date: 2026-10-12

`users.theme` stays a short preference id. Palettes live in `custom_themes`.
Downgrade drops the column. Export a backup first if those palettes must be kept.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0032"
down_revision: Union[str, None] = "0031"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "custom_themes",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text('\'{"revision": 0, "themes": []}\'::jsonb'),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "custom_themes")
