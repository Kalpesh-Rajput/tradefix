"""day notes — one rich-text note per account per day

Revision ID: 0013
Revises: 0012
Create Date: 2026-09-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())
    if "day_notes" in tables:
        return

    op.create_table(
        "day_notes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("template_id", sa.String(64), nullable=False, server_default="day-journal"),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("is_favorite", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_day_notes_user_id", "day_notes", ["user_id"])
    op.create_index("ix_day_notes_account_id", "day_notes", ["account_id"])
    op.create_index("ix_day_notes_date", "day_notes", ["date"])
    op.create_unique_constraint("uq_day_notes_user_account_date", "day_notes", ["user_id", "account_id", "date"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "day_notes" not in set(inspector.get_table_names()):
        return
    op.drop_constraint("uq_day_notes_user_account_date", "day_notes", type_="unique")
    op.drop_index("ix_day_notes_date", table_name="day_notes")
    op.drop_index("ix_day_notes_account_id", table_name="day_notes")
    op.drop_index("ix_day_notes_user_id", table_name="day_notes")
    op.drop_table("day_notes")
