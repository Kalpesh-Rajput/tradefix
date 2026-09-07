"""day notes — screenshot_urls

Revision ID: 0014
Revises: 0013
Create Date: 2026-09-07

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect, text
from sqlalchemy.dialects import postgresql

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "day_notes" not in set(inspector.get_table_names()):
        return
    columns = {col["name"] for col in inspector.get_columns("day_notes")}
    if "screenshot_urls" in columns:
        return
    op.add_column(
        "day_notes",
        sa.Column(
            "screenshot_urls",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=text("'[]'::jsonb"),
        ),
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "day_notes" not in set(inspector.get_table_names()):
        return
    columns = {col["name"] for col in inspector.get_columns("day_notes")}
    if "screenshot_urls" not in columns:
        return
    op.drop_column("day_notes", "screenshot_urls")
