from datetime import datetime
import uuid

from pydantic import BaseModel, Field, field_validator


def _cap_items(value: list | None, limit: int = 40) -> list[dict]:
    if not value:
        return []
    out: list[dict] = []
    seen: set[str] = set()
    for item in value:
        if isinstance(item, str):
            label = item.strip()[:200]
            item_id = None
        elif isinstance(item, dict):
            label = str(item.get("label") or item.get("name") or "").strip()[:200]
            item_id = item.get("id")
        else:
            continue
        if not label or label.lower() in seen:
            continue
        seen.add(label.lower())
        out.append({"id": str(item_id) if item_id else str(uuid.uuid4()), "label": label})
        if len(out) >= limit:
            break
    return out


class PrecheckListCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    items: list = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        cleaned = " ".join((v or "").split())
        if not cleaned:
            raise ValueError("Name is required")
        return cleaned

    @field_validator("items", mode="before")
    @classmethod
    def _items(cls, v):
        return _cap_items(list(v) if v else [])


class PrecheckListUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    items: list | None = None

    @field_validator("name")
    @classmethod
    def _name(cls, v: str | None) -> str | None:
        if v is None:
            return v
        cleaned = " ".join(v.split())
        if not cleaned:
            raise ValueError("Name is required")
        return cleaned

    @field_validator("items", mode="before")
    @classmethod
    def _items(cls, v):
        if v is None:
            return None
        return _cap_items(list(v))


class PrecheckListResponse(BaseModel):
    id: uuid.UUID
    name: str
    items: list = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
