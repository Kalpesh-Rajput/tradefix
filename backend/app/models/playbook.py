import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class PlaybookTemplate(Base):
    __tablename__ = "playbook_templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(80), nullable=False, unique=True, index=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    icon: Mapped[str] = mapped_column(String(16), nullable=False, default="")
    preview_image: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    categories: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    tags: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    creator_name: Mapped[str] = mapped_column(String(120), nullable=False, default="System Templates")
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    is_featured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="published", server_default="published")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    rules: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    checklist: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    playbooks: Mapped[list["Playbook"]] = relationship(back_populates="source_template")


class Playbook(Base):
    __tablename__ = "playbooks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    icon: Mapped[str] = mapped_column(String(16), nullable=False, default="")
    preview_image: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    categories: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    tags: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    source_template_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("playbook_templates.id", ondelete="SET NULL"), nullable=True, index=True
    )
    source_template_slug: Mapped[str | None] = mapped_column(String(80), nullable=True)
    source_template_version: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rules: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    checklist: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="playbooks")
    source_template: Mapped["PlaybookTemplate | None"] = relationship(back_populates="playbooks")
    trades: Mapped[list["Trade"]] = relationship(back_populates="playbook")
