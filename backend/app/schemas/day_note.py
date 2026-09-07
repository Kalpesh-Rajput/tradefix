import re
import uuid
from datetime import date as date_type
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

MAX_NOTE_CHARS = 100_000
_UNSAFE_TAGS = re.compile(r"(?is)<(script|iframe|object|embed|link)\b.*?>.*?</\1\s*>")
_UNSAFE_ATTRS = re.compile(r"""(?i)\s+on\w+\s*=\s*(['"]).*?\1""")


def sanitize_note_html(value: str) -> str:
    text = _UNSAFE_TAGS.sub("", value or "")
    text = _UNSAFE_ATTRS.sub("", text)
    return text[:MAX_NOTE_CHARS]


class DayNoteUpsert(BaseModel):
    account_id: uuid.UUID
    date: date_type
    content: str = ""
    template_id: str = Field(default="day-journal", max_length=64)
    is_favorite: bool | None = None

    @field_validator("content")
    @classmethod
    def _clean_content(cls, value: str) -> str:
        return sanitize_note_html(value)

    @field_validator("template_id")
    @classmethod
    def _clean_template(cls, value: str) -> str:
        label = (value or "day-journal").strip()[:64]
        return label or "day-journal"


class DayNoteUpdate(BaseModel):
    content: str | None = None
    template_id: str | None = Field(default=None, max_length=64)
    is_favorite: bool | None = None

    @field_validator("content")
    @classmethod
    def _clean_content(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return sanitize_note_html(value)


class DayNoteResponse(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    date: date_type
    template_id: str
    content: str
    screenshot_urls: list[str] = Field(default_factory=list)
    is_favorite: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
