"""user trading defaults

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-04

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_EMPTY_ARRAY = sa.text("'[]'::jsonb")

_COLUMNS: list[tuple[str, sa.Column]] = [
    ("default_symbol", sa.Column("default_symbol", sa.String(32), nullable=True)),
    ("default_quantity", sa.Column("default_quantity", sa.Numeric(18, 4), nullable=True)),
    ("default_fee", sa.Column("default_fee", sa.Numeric(18, 4), nullable=True)),
    ("default_forex_leverage", sa.Column("default_forex_leverage", sa.Numeric(18, 4), nullable=True)),
    (
        "default_strategies",
        sa.Column(
            "default_strategies",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=_EMPTY_ARRAY,
        ),
    ),
    (
        "custom_strategies",
        sa.Column(
            "custom_strategies",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=_EMPTY_ARRAY,
        ),
    ),
    (
        "strategy_order",
        sa.Column(
            "strategy_order",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=_EMPTY_ARRAY,
        ),
    ),
    (
        "custom_mistakes",
        sa.Column(
            "custom_mistakes",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=_EMPTY_ARRAY,
        ),
    ),
    (
        "mistake_order",
        sa.Column(
            "mistake_order",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=_EMPTY_ARRAY,
        ),
    ),
]


def upgrade() -> None:
    bind = op.get_bind()
    existing = {col["name"] for col in inspect(bind).get_columns("users")}
    for name, column in _COLUMNS:
        if name not in existing:
            op.add_column("users", column)


def downgrade() -> None:
    bind = op.get_bind()
    existing = {col["name"] for col in inspect(bind).get_columns("users")}
    for name, _ in reversed(_COLUMNS):
        if name in existing:
            op.drop_column("users", name)
