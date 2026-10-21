"""Chart drawing contract. Anchors are chart time (epoch ms UTC) and price, never pixels."""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.chart_drawing import MAX_ANCHORS

TOOLS = frozenset(
    {
        "trendline", "ray", "extended_line", "horizontal_line", "horizontal_ray", "vertical_line", "crossline", "info_line",
        "parallel_channel", "fib_retracement", "fib_extension", "rectangle", "ellipse", "triangle", "arrow",
        "text", "price_label", "price_range", "date_range", "date_price_range", "long_position", "short_position",
    }
)
MAX_BLOB_BYTES = 8_000
MAX_SYNC_ITEMS = 200
MAX_PER_WORKSPACE = 500


class Anchor(BaseModel):
    time_ms: int = Field(ge=0, le=10_000_000_000_000)
    price: float = Field(ge=-1e12, le=1e12)


def _blob_size(value: Any) -> int:
    return len(json.dumps(value, separators=(",", ":")).encode("utf-8"))


class DrawingIn(BaseModel):
    id: uuid.UUID
    tool: str
    symbol: str = Field(min_length=1, max_length=32)
    source: str | None = Field(default=None, max_length=32)
    timeframe: str | None = Field(default=None, max_length=8)
    anchors: list[Anchor] = Field(max_length=MAX_ANCHORS)
    style: dict[str, Any] = Field(default_factory=dict)
    props: dict[str, Any] = Field(default_factory=dict)
    visible: bool = True
    locked: bool = False
    z_order: int = Field(default=0, ge=0, le=1_000_000)
    schema_version: int = Field(default=1, ge=1, le=1000)

    @field_validator("tool")
    @classmethod
    def known_tool(cls, value: str) -> str:
        if value not in TOOLS:
            raise ValueError("unsupported drawing tool")
        return value

    @field_validator("style", "props")
    @classmethod
    def bounded(cls, value: dict[str, Any]) -> dict[str, Any]:
        if _blob_size(value) > MAX_BLOB_BYTES:
            raise ValueError("drawing configuration is too large")
        return value


class DrawingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tool: str
    symbol: str
    source: str | None
    timeframe: str | None
    anchors: list[Anchor]
    style: dict[str, Any]
    props: dict[str, Any]
    visible: bool
    locked: bool
    z_order: int
    schema_version: int
    created_at: datetime
    updated_at: datetime


class SyncIn(BaseModel):
    workspace: str = Field(min_length=1, max_length=96)
    session_id: uuid.UUID | None = None
    upserts: list[DrawingIn] = Field(default_factory=list, max_length=MAX_SYNC_ITEMS)
    deletes: list[uuid.UUID] = Field(default_factory=list, max_length=MAX_SYNC_ITEMS)


class SyncOut(BaseModel):
    saved: int
    deleted: int
