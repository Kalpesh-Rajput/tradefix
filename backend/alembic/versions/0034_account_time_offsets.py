"""Detected trade-time basis per journal account (backtesting 2A, D-013, D-023).

Revision ID: 0034
Revises: 0033
Create Date: 2026-10-14
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0034"
down_revision: Union[str, None] = "0033"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "account_time_offsets",
        sa.Column(
            "account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("accounts.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("broker_account_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("tz_kind", sa.String(16), nullable=False),
        sa.Column("tz_value", sa.String(64), nullable=False),
        sa.Column("confidence", sa.String(16), nullable=False),
        sa.Column("match_rate", sa.Float(), nullable=False, server_default="0"),
        sa.Column("sample_size", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("runner_up", sa.String(64), nullable=True),
        sa.Column("runner_up_rate", sa.Float(), nullable=True),
        sa.Column("method", sa.String(32), nullable=False),
        sa.Column("scores", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("computed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("tz_kind IN ('iana', 'fixed', 'ny_close')", name="ck_time_offset_kind"),
        sa.CheckConstraint("confidence IN ('high', 'medium', 'low', 'unknown')", name="ck_time_offset_confidence"),
    )
    op.create_index("ix_account_time_offsets_user_id", "account_time_offsets", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_account_time_offsets_user_id", table_name="account_time_offsets")
    op.drop_table("account_time_offsets")
