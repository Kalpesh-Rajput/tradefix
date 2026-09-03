from datetime import datetime
import uuid

from pydantic import BaseModel, Field, field_validator

from app.models.trade_master import MasterCategory


class TradeMasterCreate(BaseModel):
    category: MasterCategory
    name: str = Field(min_length=1, max_length=100)

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        cleaned = " ".join((v or "").split())
        if not cleaned:
            raise ValueError("Name is required")
        return cleaned


class TradeMasterUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    sort_order: int | None = None

    @field_validator("name")
    @classmethod
    def _name(cls, v: str | None) -> str | None:
        if v is None:
            return v
        cleaned = " ".join(v.split())
        if not cleaned:
            raise ValueError("Name is required")
        return cleaned


class TradeMasterResponse(BaseModel):
    id: uuid.UUID
    category: MasterCategory
    name: str
    sort_order: int
    is_builtin: bool
    created_at: datetime

    class Config:
        from_attributes = True
