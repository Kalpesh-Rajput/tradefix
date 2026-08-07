"""daily recaps journal entries

Revision ID: 0008
Revises: 0007
Create Date: 2026-08-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    day_mood = postgresql.ENUM("good", "mixed", "tough", name="day_mood", create_type=False)
    day_mood.create(bind, checkfirst=True)

    if "daily_recaps" not in tables:
        op.create_table(
            "daily_recaps",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column(
                "account_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("accounts.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("date", sa.Date(), nullable=False),
            sa.Column("day_mood", day_mood, nullable=True),
            sa.Column("work_on", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
            sa.Column("best_decision", sa.Text(), nullable=True),
            sa.Column("reflection", sa.Text(), nullable=True),
            sa.Column("pnl_override", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("gross_pnl", sa.Numeric(18, 2), nullable=True),
            sa.Column("fees", sa.Numeric(18, 2), nullable=True),
            sa.Column("net_pnl", sa.Numeric(18, 2), nullable=True),
            sa.Column(
                "screenshot_urls",
                postgresql.JSONB(),
                nullable=False,
                server_default=sa.text("'[]'::jsonb"),
            ),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.UniqueConstraint("user_id", "account_id", "date", name="uq_daily_recaps_user_account_date"),
        )
        op.create_index("ix_daily_recaps_user_id", "daily_recaps", ["user_id"])
        op.create_index("ix_daily_recaps_account_id", "daily_recaps", ["account_id"])
        op.create_index("ix_daily_recaps_date", "daily_recaps", ["date"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())
    if "daily_recaps" in tables:
        op.drop_index("ix_daily_recaps_date", table_name="daily_recaps")
        op.drop_index("ix_daily_recaps_account_id", table_name="daily_recaps")
        op.drop_index("ix_daily_recaps_user_id", table_name="daily_recaps")
        op.drop_table("daily_recaps")
    postgresql.ENUM(name="day_mood").drop(bind, checkfirst=True)
