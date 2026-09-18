"""playbooks + playbook_templates + trades.playbook_id

Revision ID: 0020
Revises: 0019
Create Date: 2026-09-15

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "0020"
down_revision: Union[str, None] = "0019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if "playbook_templates" not in tables:
        op.create_table(
            "playbook_templates",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("slug", sa.String(80), nullable=False),
            sa.Column("title", sa.String(160), nullable=False),
            sa.Column("description", sa.Text(), nullable=False, server_default=""),
            sa.Column("icon", sa.String(16), nullable=False, server_default=""),
            sa.Column("preview_image", sa.String(1024), nullable=True),
            sa.Column("categories", postgresql.JSONB(), nullable=False, server_default="[]"),
            sa.Column("tags", postgresql.JSONB(), nullable=False, server_default="[]"),
            sa.Column("creator_name", sa.String(120), nullable=False, server_default="System Templates"),
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("is_system", sa.Boolean(), nullable=False, server_default="true"),
            sa.Column("is_featured", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("status", sa.String(20), nullable=False, server_default="published"),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("rules", postgresql.JSONB(), nullable=False, server_default="{}"),
            sa.Column("checklist", postgresql.JSONB(), nullable=False, server_default="[]"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_playbook_templates_slug", "playbook_templates", ["slug"], unique=True)

    if "playbooks" not in tables:
        op.create_table(
            "playbooks",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("name", sa.String(160), nullable=False),
            sa.Column("description", sa.Text(), nullable=False, server_default=""),
            sa.Column("icon", sa.String(16), nullable=False, server_default=""),
            sa.Column("preview_image", sa.String(1024), nullable=True),
            sa.Column("categories", postgresql.JSONB(), nullable=False, server_default="[]"),
            sa.Column("tags", postgresql.JSONB(), nullable=False, server_default="[]"),
            sa.Column(
                "source_template_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("playbook_templates.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("source_template_slug", sa.String(80), nullable=True),
            sa.Column("source_template_version", sa.Integer(), nullable=True),
            sa.Column("rules", postgresql.JSONB(), nullable=False, server_default="{}"),
            sa.Column("checklist", postgresql.JSONB(), nullable=False, server_default="[]"),
            sa.Column("is_archived", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_playbooks_user_id", "playbooks", ["user_id"])
        op.create_index("ix_playbooks_source_template_id", "playbooks", ["source_template_id"])
        op.create_index("ix_playbooks_is_archived", "playbooks", ["is_archived"])
        op.create_index(
            "uq_playbooks_user_template_active",
            "playbooks",
            ["user_id", "source_template_id"],
            unique=True,
            postgresql_where=sa.text("source_template_id IS NOT NULL AND is_archived = false"),
        )

    trade_cols = {col["name"] for col in inspector.get_columns("trades")}
    if "playbook_id" not in trade_cols:
        op.add_column(
            "trades",
            sa.Column(
                "playbook_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("playbooks.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )
        op.create_index("ix_trades_playbook_id", "trades", ["playbook_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    trade_cols = {col["name"] for col in inspector.get_columns("trades")}
    if "playbook_id" in trade_cols:
        op.drop_index("ix_trades_playbook_id", table_name="trades")
        op.drop_column("trades", "playbook_id")
    tables = set(inspector.get_table_names())
    if "playbooks" in tables:
        op.drop_index("uq_playbooks_user_template_active", table_name="playbooks")
        op.drop_table("playbooks")
    if "playbook_templates" in tables:
        op.drop_table("playbook_templates")
