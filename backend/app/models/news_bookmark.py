from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class NewsBookmark(Base):
    __tablename__ = "news_bookmarks"
    __table_args__ = (
        UniqueConstraint("user_id", "article_id", name="uq_news_bookmarks_user_article"),
        Index("ix_news_bookmarks_user_saved", "user_id", "saved_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    article_id: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    source: Mapped[str] = mapped_column(String(255), nullable=False)
    source_domain: Mapped[str | None] = mapped_column(String(255), nullable=True)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False, default="all", server_default="all")
    symbols: Mapped[list[str]] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        server_default=text("'[]'::jsonb"),
    )
    symbols_source: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default="none",
        server_default="none",
    )
    sentiment: Mapped[str | None] = mapped_column(String(16), nullable=True)
    sentiment_score: Mapped[float | None] = mapped_column(nullable=True)
    provider: Mapped[str] = mapped_column(String(32), nullable=False, default="google_rss", server_default="google_rss")
    saved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user: Mapped["User"] = relationship(back_populates="news_bookmarks")
