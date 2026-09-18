from datetime import datetime
import uuid

from pydantic import BaseModel, Field, field_validator


def _clean_name(v: str) -> str:
    cleaned = " ".join((v or "").split())
    if not cleaned:
        raise ValueError("Name is required")
    return cleaned[:160]


class PlaybookRules(BaseModel):
    style: str = ""
    entry: list[str] = Field(default_factory=list)
    confirmation: list[str] = Field(default_factory=list)
    risk: list[str] = Field(default_factory=list)
    exit: list[str] = Field(default_factory=list)
    notes: str = ""


class PlaybookTemplateResponse(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    description: str
    icon: str = ""
    preview_image: str | None = None
    categories: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    creator_name: str
    version: int
    is_system: bool
    is_featured: bool
    status: str
    sort_order: int
    rules: dict = Field(default_factory=dict)
    checklist: list = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PlaybookResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str
    icon: str = ""
    preview_image: str | None = None
    categories: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    source_template_id: uuid.UUID | None = None
    source_template_slug: str | None = None
    source_template_version: int | None = None
    rules: dict = Field(default_factory=dict)
    checklist: list = Field(default_factory=list)
    is_archived: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PlaybookCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: str = ""
    icon: str = ""
    categories: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    rules: dict = Field(default_factory=dict)
    checklist: list = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        return _clean_name(v)


class PlaybookUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = None
    icon: str | None = None
    categories: list[str] | None = None
    tags: list[str] | None = None
    rules: dict | None = None
    checklist: list | None = None
    is_archived: bool | None = None

    @field_validator("name")
    @classmethod
    def _name(cls, v: str | None) -> str | None:
        if v is None:
            return v
        return _clean_name(v)


class PlaybookFromTemplate(BaseModel):
    slug: str = Field(min_length=1, max_length=80)
