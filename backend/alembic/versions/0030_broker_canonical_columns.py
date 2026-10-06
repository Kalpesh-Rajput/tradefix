"""Canonical execution columns and connection error fields.

Revision ID: 0030
Revises: 0029
Create Date: 2026-10-06

Additive. Existing journal accounts with broker_id stay labels.
No broker_connections rows are inserted: those labels are not credentials.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0030"
down_revision: Union[str, None] = "0029"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("broker_connections", sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("broker_connections", sa.Column("last_error", sa.Text(), nullable=True))
    op.add_column(
        "broker_connections",
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("broker_executions", sa.Column("fees", sa.Numeric(24, 8), nullable=False, server_default="0"))
    op.add_column("broker_executions", sa.Column("position_side", sa.String(16), nullable=True))
    op.add_column("broker_executions", sa.Column("asset_class", sa.String(32), nullable=True))
    op.add_column("broker_executions", sa.Column("instrument_type", sa.String(32), nullable=True))
    op.add_column("broker_executions", sa.Column("stop_loss", sa.Numeric(24, 8), nullable=True))
    op.add_column("broker_executions", sa.Column("take_profit", sa.Numeric(24, 8), nullable=True))
    op.add_column("broker_executions", sa.Column("leverage", sa.Numeric(24, 8), nullable=True))
    op.add_column("broker_executions", sa.Column("contract_size", sa.Numeric(24, 8), nullable=True))
    op.add_column(
        "broker_executions",
        sa.Column("extra", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )
    op.execute("UPDATE trades SET source = 'manual' WHERE source IS NULL OR source = ''")


def downgrade() -> None:
    op.drop_column("broker_executions", "extra")
    op.drop_column("broker_executions", "contract_size")
    op.drop_column("broker_executions", "leverage")
    op.drop_column("broker_executions", "take_profit")
    op.drop_column("broker_executions", "stop_loss")
    op.drop_column("broker_executions", "instrument_type")
    op.drop_column("broker_executions", "asset_class")
    op.drop_column("broker_executions", "position_side")
    op.drop_column("broker_executions", "fees")
    op.drop_column("broker_connections", "retry_count")
    op.drop_column("broker_connections", "last_error")
    op.drop_column("broker_connections", "last_sync_at")
