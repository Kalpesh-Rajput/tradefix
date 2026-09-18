"""date-scoped day plans: game plan items, events, briefing

Revision ID: 0022
Revises: 0021
Create Date: 2026-09-16

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "0022"
down_revision: Union[str, None] = "0021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if "day_plans" not in tables:
        op.create_table(
            "day_plans",
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
            sa.Column("briefing", sa.Text(), nullable=False, server_default=""),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_day_plans_user_id", "day_plans", ["user_id"])
        op.create_index("ix_day_plans_account_id", "day_plans", ["account_id"])
        op.create_index("ix_day_plans_date", "day_plans", ["date"])
        op.create_unique_constraint("uq_day_plans_user_account_date", "day_plans", ["user_id", "account_id", "date"])

    if "day_plan_items" not in tables:
        op.create_table(
            "day_plan_items",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "plan_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("day_plans.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("label", sa.String(160), nullable=False),
            sa.Column("done", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_day_plan_items_plan_id", "day_plan_items", ["plan_id"])

    if "day_plan_events" not in tables:
        op.create_table(
            "day_plan_events",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "plan_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("day_plans.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("title", sa.String(160), nullable=False),
            sa.Column("note", sa.String(240), nullable=True),
            sa.Column("occurs_on", sa.Date(), nullable=False),
            sa.Column("impact", sa.String(16), nullable=False, server_default="medium"),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_day_plan_events_plan_id", "day_plan_events", ["plan_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())
    if "day_plan_events" in tables:
        op.drop_table("day_plan_events")
    if "day_plan_items" in tables:
        op.drop_table("day_plan_items")
    if "day_plans" in tables:
        op.drop_table("day_plans")
