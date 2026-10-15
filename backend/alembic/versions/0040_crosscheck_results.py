"""Daily cross-check results (backtesting follow-up F5).

Revision ID: 0040
Revises: 0039
Create Date: 2026-10-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0040"
down_revision: Union[str, None] = "0039"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "crosscheck_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("instrument", sa.String(32), sa.ForeignKey("instruments.symbol", ondelete="CASCADE"), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("stored_close", sa.Float()),
        sa.Column("stored_high", sa.Float()),
        sa.Column("stored_low", sa.Float()),
        sa.Column("reference_close", sa.Float()),
        sa.Column("difference", sa.Float()),
        sa.Column("tolerance", sa.Float(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("detail", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("instrument", "day", name="uq_crosscheck_day"),
    )


def downgrade() -> None:
    op.drop_table("crosscheck_results")
