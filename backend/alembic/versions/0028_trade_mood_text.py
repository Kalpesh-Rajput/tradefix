"""Widen trades.mood so multiple mood labels can be stored.

Revision ID: 0028
Revises: 0027
Create Date: 2026-10-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0028"
down_revision: Union[str, None] = "0027"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("trades", "mood", existing_type=sa.String(length=50), type_=sa.Text(), existing_nullable=True)


def downgrade() -> None:
    op.alter_column("trades", "mood", existing_type=sa.Text(), type_=sa.String(length=50), existing_nullable=True)
