"""Provider cool-downs, candle file imports, and month provenance (backtesting follow-up F4).

Revision ID: 0039
Revises: 0038
Create Date: 2026-10-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0039"
down_revision: Union[str, None] = "0038"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "provider_cooldowns",
        sa.Column("provider", sa.String(32), primary_key=True),
        sa.Column("blocked_until", sa.DateTime(timezone=True), nullable=False),
        sa.Column("http_status", sa.Integer()),
        sa.Column("excerpt", sa.String(300), nullable=False, server_default=""),
        sa.Column("detected_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "candle_imports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("instrument", sa.String(32), sa.ForeignKey("instruments.symbol", ondelete="CASCADE"), nullable=False),
        sa.Column("source", sa.String(16), nullable=False),
        sa.Column("label", sa.String(120), nullable=False),
        sa.Column("price_side", sa.String(16), nullable=False),
        sa.Column("timezone_name", sa.String(64), nullable=False),
        sa.Column("preset", sa.String(32), nullable=False),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("filenames", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("summary", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("instrument", "content_hash", name="uq_candle_import_hash"),
    )
    op.add_column("candle_month_stats", sa.Column("price_side", sa.String(16)))
    op.add_column(
        "candle_month_stats",
        sa.Column("sources", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
    )


def downgrade() -> None:
    op.drop_column("candle_month_stats", "sources")
    op.drop_column("candle_month_stats", "price_side")
    op.drop_table("candle_imports")
    op.drop_table("provider_cooldowns")
