"""User onboarding survey fields

Revision ID: 0011
Revises: 0010
Create Date: 2026-08-08

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_COLUMNS: list[tuple[str, sa.Column]] = [
    ("onboarding_step", sa.Column("onboarding_step", sa.Integer(), nullable=False, server_default="0")),
    ("trading_experience", sa.Column("trading_experience", sa.String(32), nullable=True)),
    (
        "capital_sources",
        sa.Column("capital_sources", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
    ),
    ("primary_broker", sa.Column("primary_broker", sa.String(128), nullable=True)),
    (
        "markets_traded",
        sa.Column("markets_traded", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
    ),
    (
        "onboarding_goals",
        sa.Column("onboarding_goals", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
    ),
    ("referral_source", sa.Column("referral_source", sa.String(64), nullable=True)),
    ("referral_detail", sa.Column("referral_detail", sa.String(255), nullable=True)),
    ("onboarding_completed_at", sa.Column("onboarding_completed_at", sa.DateTime(timezone=True), nullable=True)),
]


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    existing = {col["name"] for col in inspector.get_columns("users")}

    for name, column in _COLUMNS:
        if name not in existing:
            op.add_column("users", column)

    # Existing accounts skip the new wizard
    op.execute(
        "UPDATE users SET onboarding_completed_at = COALESCE(created_at, NOW()) "
        "WHERE onboarding_completed_at IS NULL"
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    existing = {col["name"] for col in inspector.get_columns("users")}

    for name, _ in reversed(_COLUMNS):
        if name in existing:
            op.drop_column("users", name)
