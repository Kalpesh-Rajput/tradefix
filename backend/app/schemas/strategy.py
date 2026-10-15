"""Strategy API contract."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel


class StrategyOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str
    schema_version: int
    definition: dict
    created_at: datetime | None
    updated_at: datetime | None


class FieldError(BaseModel):
    field: str
    message: str


class ValidateOut(BaseModel):
    ok: bool
    errors: list[FieldError]
    estimated_bars: int | None
