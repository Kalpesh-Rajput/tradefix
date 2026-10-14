"""Notes pinned to replay times on journal trades (backtesting 2B).

Revision ID: 0035
Revises: 0034
Create Date: 2026-10-14
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0035"
down_revision: Union[str, None] = "0034"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "trade_replay_notes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("trade_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("trades.id", ondelete="CASCADE"), nullable=False),
        sa.Column("replay_time_ms", sa.BigInteger(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("char_length(text) BETWEEN 1 AND 2000", name="ck_replay_note_text"),
    )
    op.create_index("ix_trade_replay_notes_user_trade", "trade_replay_notes", ["user_id", "trade_id"])


def downgrade() -> None:
    op.drop_index("ix_trade_replay_notes_user_trade", table_name="trade_replay_notes")
    op.drop_table("trade_replay_notes")
