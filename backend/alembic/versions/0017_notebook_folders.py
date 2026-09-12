"""notebook folders + day_notes.folder_id

Revision ID: 0017
Revises: 0016
Create Date: 2026-09-09

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "0017"
down_revision: Union[str, None] = "0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if "notebook_folders" not in tables:
        op.create_table(
            "notebook_folders",
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
            sa.Column("name", sa.String(48), nullable=False),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_notebook_folders_user_id", "notebook_folders", ["user_id"])
        op.create_index("ix_notebook_folders_account_id", "notebook_folders", ["account_id"])
        op.create_unique_constraint(
            "uq_notebook_folders_user_account_name",
            "notebook_folders",
            ["user_id", "account_id", "name"],
        )

    columns = {col["name"] for col in inspector.get_columns("day_notes")} if "day_notes" in tables else set()
    if "day_notes" in tables and "folder_id" not in columns:
        op.add_column(
            "day_notes",
            sa.Column(
                "folder_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("notebook_folders.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )
        op.create_index("ix_day_notes_folder_id", "day_notes", ["folder_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())
    if "day_notes" in tables:
        columns = {col["name"] for col in inspector.get_columns("day_notes")}
        if "folder_id" in columns:
            op.drop_index("ix_day_notes_folder_id", table_name="day_notes")
            op.drop_column("day_notes", "folder_id")
    if "notebook_folders" in tables:
        op.drop_constraint("uq_notebook_folders_user_account_name", "notebook_folders", type_="unique")
        op.drop_index("ix_notebook_folders_account_id", table_name="notebook_folders")
        op.drop_index("ix_notebook_folders_user_id", table_name="notebook_folders")
        op.drop_table("notebook_folders")
