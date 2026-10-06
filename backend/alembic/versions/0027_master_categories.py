"""Mistake and what-went-well masters, plus soft deactivate.

Revision ID: 0027
Revises: 0026
Create Date: 2026-10-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "0027"
down_revision: Union[str, None] = "0026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(inspector, table: str, name: str) -> bool:
    return name in {col["name"] for col in inspector.get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    with op.get_context().autocommit_block():
        for value in ("mistake", "went_well"):
            op.execute(f"ALTER TYPE master_category ADD VALUE IF NOT EXISTS '{value}'")

    inspector = inspect(bind)
    if "trade_masters" in set(inspector.get_table_names()) and not _has_column(inspector, "trade_masters", "is_active"):
        op.add_column(
            "trade_masters",
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "trade_masters" in set(inspector.get_table_names()) and _has_column(inspector, "trade_masters", "is_active"):
        op.drop_column("trade_masters", "is_active")
