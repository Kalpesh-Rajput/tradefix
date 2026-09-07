"""trades — profit_target and rating

Revision ID: 0015
Revises: 0014
Create Date: 2026-09-07

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "trades" not in set(inspector.get_table_names()):
        return
    columns = {col["name"] for col in inspector.get_columns("trades")}
    if "profit_target" not in columns:
        op.add_column("trades", sa.Column("profit_target", sa.Numeric(18, 6), nullable=True))
    if "rating" not in columns:
        op.add_column("trades", sa.Column("rating", sa.Integer(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "trades" not in set(inspector.get_table_names()):
        return
    columns = {col["name"] for col in inspector.get_columns("trades")}
    if "rating" in columns:
        op.drop_column("trades", "rating")
    if "profit_target" in columns:
        op.drop_column("trades", "profit_target")
