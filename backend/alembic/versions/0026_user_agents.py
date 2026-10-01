"""User-configured agents, run payloads, AI notes, tag suggestions, notifications.

Revision ID: 0026
Revises: 0025
Create Date: 2026-09-23

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "0026"
down_revision: Union[str, None] = "0025"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(inspector, table: str, name: str) -> bool:
    return name in {col["name"] for col in inspector.get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    with op.get_context().autocommit_block():
        for value in ("running", "completed", "partial"):
            op.execute(f"ALTER TYPE agent_run_status ADD VALUE IF NOT EXISTS '{value}'")

    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if "user_agents" not in tables:
        op.create_table(
            "user_agents",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("template_key", sa.String(64), nullable=False),
            sa.Column("status", sa.String(16), nullable=False, server_default="paused"),
            sa.Column("trigger_types", postgresql.JSONB(), nullable=False, server_default="[]"),
            sa.Column("configuration", postgresql.JSONB(), nullable=False, server_default="{}"),
            sa.Column("instructions", sa.Text(), nullable=False, server_default=""),
            sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("user_id", "template_key", name="uq_user_agents_user_template"),
        )
        op.create_index("ix_user_agents_user_id", "user_agents", ["user_id"])

    inspector = inspect(bind)
    if "agent_runs" in set(inspector.get_table_names()):
        if not _has_column(inspector, "agent_runs", "user_agent_id"):
            op.add_column(
                "agent_runs",
                sa.Column("user_agent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("user_agents.id", ondelete="SET NULL"), nullable=True),
            )
            op.create_index("ix_agent_runs_user_agent_id", "agent_runs", ["user_agent_id"])
        if not _has_column(inspector, "agent_runs", "trigger"):
            op.add_column("agent_runs", sa.Column("trigger", sa.String(32), nullable=True))
        if not _has_column(inspector, "agent_runs", "started_at"):
            op.add_column("agent_runs", sa.Column("started_at", sa.DateTime(timezone=True), nullable=True))
        if not _has_column(inspector, "agent_runs", "completed_at"):
            op.add_column("agent_runs", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))
        if not _has_column(inspector, "agent_runs", "input_context"):
            op.add_column("agent_runs", sa.Column("input_context", postgresql.JSONB(), nullable=False, server_default="{}"))
        if not _has_column(inspector, "agent_runs", "output"):
            op.add_column("agent_runs", sa.Column("output", postgresql.JSONB(), nullable=False, server_default="{}"))
        if not _has_column(inspector, "agent_runs", "error"):
            op.add_column("agent_runs", sa.Column("error", sa.Text(), nullable=True))
        if not _has_column(inspector, "agent_runs", "metadata"):
            op.add_column("agent_runs", sa.Column("metadata", postgresql.JSONB(), nullable=False, server_default="{}"))
        op.alter_column("agent_runs", "agent_name", existing_type=sa.String(50), type_=sa.String(64), existing_nullable=False)

    inspector = inspect(bind)
    if "user_notifications" not in set(inspector.get_table_names()):
        op.create_table(
            "user_notifications",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("agent_run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("agent_runs.id", ondelete="SET NULL"), nullable=True),
            sa.Column("title", sa.String(160), nullable=False),
            sa.Column("body", sa.Text(), nullable=False, server_default=""),
            sa.Column("href", sa.String(512), nullable=False, server_default="/agents"),
            sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_user_notifications_user_id", "user_notifications", ["user_id"])
        op.create_index("ix_user_notifications_agent_run_id", "user_notifications", ["agent_run_id"])
        op.create_index("ix_user_notifications_created_at", "user_notifications", ["created_at"])

    inspector = inspect(bind)
    if "trades" in set(inspector.get_table_names()) and not _has_column(inspector, "trades", "ai_tag_suggestions"):
        op.add_column("trades", sa.Column("ai_tag_suggestions", postgresql.JSONB(), nullable=False, server_default="[]"))

    inspector = inspect(bind)
    if "day_notes" in set(inspector.get_table_names()):
        if not _has_column(inspector, "day_notes", "kind"):
            op.add_column("day_notes", sa.Column("kind", sa.String(32), nullable=False, server_default="journal"))
        if not _has_column(inspector, "day_notes", "agent_run_id"):
            op.add_column(
                "day_notes",
                sa.Column("agent_run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("agent_runs.id", ondelete="SET NULL"), nullable=True),
            )
            op.create_index("ix_day_notes_agent_run_id", "day_notes", ["agent_run_id"])
        names = {item["name"] for item in inspect(bind).get_unique_constraints("day_notes")}
        if "uq_day_notes_user_account_date" in names:
            op.drop_constraint("uq_day_notes_user_account_date", "day_notes", type_="unique")
        names = {item["name"] for item in inspect(bind).get_unique_constraints("day_notes")}
        if "uq_day_notes_user_account_date_kind" not in names:
            op.create_unique_constraint(
                "uq_day_notes_user_account_date_kind",
                "day_notes",
                ["user_id", "account_id", "date", "kind"],
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())
    if "day_notes" in tables:
        names = {item["name"] for item in inspector.get_unique_constraints("day_notes")}
        if "uq_day_notes_user_account_date_kind" in names:
            op.drop_constraint("uq_day_notes_user_account_date_kind", "day_notes", type_="unique")
        if "uq_day_notes_user_account_date" not in names:
            op.create_unique_constraint("uq_day_notes_user_account_date", "day_notes", ["user_id", "account_id", "date"])
        if _has_column(inspector, "day_notes", "agent_run_id"):
            op.drop_index("ix_day_notes_agent_run_id", table_name="day_notes")
            op.drop_column("day_notes", "agent_run_id")
        if _has_column(inspector, "day_notes", "kind"):
            op.drop_column("day_notes", "kind")
    if "trades" in tables and _has_column(inspector, "trades", "ai_tag_suggestions"):
        op.drop_column("trades", "ai_tag_suggestions")
    if "user_notifications" in tables:
        op.drop_index("ix_user_notifications_created_at", table_name="user_notifications")
        op.drop_index("ix_user_notifications_agent_run_id", table_name="user_notifications")
        op.drop_index("ix_user_notifications_user_id", table_name="user_notifications")
        op.drop_table("user_notifications")
    if "agent_runs" in tables and _has_column(inspector, "agent_runs", "user_agent_id"):
        op.drop_index("ix_agent_runs_user_agent_id", table_name="agent_runs")
        op.drop_column("agent_runs", "user_agent_id")
        for column in ("trigger", "started_at", "completed_at", "input_context", "output", "error", "metadata"):
            if _has_column(inspector, "agent_runs", column):
                op.drop_column("agent_runs", column)
    if "user_agents" in tables:
        op.drop_index("ix_user_agents_user_id", table_name="user_agents")
        op.drop_table("user_agents")
