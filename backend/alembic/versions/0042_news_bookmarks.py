"""News bookmarks.

Revision ID: 0042
Revises: 0041
Create Date: 2026-10-22
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0042"
down_revision: Union[str, None] = "0041"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "news_bookmarks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("article_id", sa.String(64), nullable=False),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("url", sa.String(2048), nullable=False),
        sa.Column("source", sa.String(255), nullable=False),
        sa.Column("source_domain", sa.String(255), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("category", sa.String(32), nullable=False, server_default="all"),
        sa.Column(
            "symbols",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("symbols_source", sa.String(16), nullable=False, server_default="none"),
        sa.Column("sentiment", sa.String(16), nullable=True),
        sa.Column("sentiment_score", sa.Float(), nullable=True),
        sa.Column("provider", sa.String(32), nullable=False, server_default="google_rss"),
        sa.Column("saved_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "article_id", name="uq_news_bookmarks_user_article"),
    )
    op.create_index("ix_news_bookmarks_user_saved", "news_bookmarks", ["user_id", "saved_at"])


def downgrade() -> None:
    op.drop_index("ix_news_bookmarks_user_saved", table_name="news_bookmarks")
    op.drop_table("news_bookmarks")
