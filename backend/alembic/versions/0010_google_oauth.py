"""Google OAuth: nullable password_hash, google_id, auth_provider

Revision ID: 0010
Revises: 0009
Create Date: 2026-08-07

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("users")}

    if "google_id" not in columns:
        op.add_column("users", sa.Column("google_id", sa.String(255), nullable=True))
        op.create_index("ix_users_google_id", "users", ["google_id"], unique=True)

    if "auth_provider" not in columns:
        op.add_column(
            "users",
            sa.Column("auth_provider", sa.String(32), nullable=False, server_default="email"),
        )

    op.alter_column(
        "users",
        "password_hash",
        existing_type=sa.String(255),
        nullable=True,
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("users")}

    # Prevent downgrade if Google-only users would violate NOT NULL
    op.execute(
        "UPDATE users SET password_hash = '' WHERE password_hash IS NULL"
    )
    op.alter_column(
        "users",
        "password_hash",
        existing_type=sa.String(255),
        nullable=False,
    )

    if "auth_provider" in columns:
        op.drop_column("users", "auth_provider")

    if "google_id" in columns:
        op.drop_index("ix_users_google_id", table_name="users")
        op.drop_column("users", "google_id")
