import uuid
from datetime import datetime

from pydantic import BaseModel


class WatchlistItemCreate(BaseModel):
    symbol: str
    notes: str | None = None


class WatchlistItemResponse(BaseModel):
    id: uuid.UUID
    symbol: str
    notes: str | None
    created_at: datetime

    class Config:
        from_attributes = True
