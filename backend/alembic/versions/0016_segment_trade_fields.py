"""trades — segment-specific contract fields

Revision ID: 0016
Revises: 0015
Create Date: 2026-09-08

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "0016"
down_revision: Union[str, None] = "0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COLUMNS = (
    ("strike_price", sa.Column("strike_price", sa.Numeric(18, 6), nullable=True)),
    ("expiry_date", sa.Column("expiry_date", sa.Date(), nullable=True)),
    ("tick_size", sa.Column("tick_size", sa.Numeric(18, 8), nullable=True)),
    ("tick_value", sa.Column("tick_value", sa.Numeric(18, 6), nullable=True)),
    ("position_value", sa.Column("position_value", sa.Numeric(18, 2), nullable=True)),
    ("margin_used", sa.Column("margin_used", sa.Numeric(18, 2), nullable=True)),
)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "trades" not in set(inspector.get_table_names()):
        return
    existing = {col["name"] for col in inspector.get_columns("trades")}
    for name, column in COLUMNS:
        if name not in existing:
            op.add_column("trades", column)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "trades" not in set(inspector.get_table_names()):
        return
    existing = {col["name"] for col in inspector.get_columns("trades")}
    for name, _ in reversed(COLUMNS):
        if name in existing:
            op.drop_column("trades", name)
