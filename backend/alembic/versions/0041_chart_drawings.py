"""Chart drawings.

Revision ID: 0041
Revises: 0040
Create Date: 2026-10-20
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0041"
down_revision: Union[str, None] = "0040"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "chart_drawings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("workspace", sa.String(96), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("backtest_sessions.id", ondelete="CASCADE")),
        sa.Column("symbol", sa.String(32), nullable=False),
        sa.Column("source", sa.String(32)),
        sa.Column("timeframe", sa.String(8)),
        sa.Column("tool", sa.String(32), nullable=False),
        sa.Column("anchors", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("style", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("props", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("visible", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("locked", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("z_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("schema_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("schema_version >= 1", name="ck_chart_drawing_version"),
        sa.CheckConstraint("char_length(workspace) BETWEEN 1 AND 96", name="ck_chart_drawing_workspace"),
    )
    op.create_index("ix_chart_drawings_lookup", "chart_drawings", ["user_id", "workspace", "symbol"])
    op.create_index("ix_chart_drawings_session", "chart_drawings", ["session_id"])


def downgrade() -> None:
    op.drop_index("ix_chart_drawings_session", table_name="chart_drawings")
    op.drop_index("ix_chart_drawings_lookup", table_name="chart_drawings")
    op.drop_table("chart_drawings")
