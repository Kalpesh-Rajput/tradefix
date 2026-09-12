import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class NotebookFolderCreate(BaseModel):
    account_id: uuid.UUID
    name: str = Field(min_length=1, max_length=48)

    @field_validator("name")
    @classmethod
    def _clean_name(cls, value: str) -> str:
        label = " ".join((value or "").split())
        if not label:
            raise ValueError("Folder name is required")
        return label[:48]


class NotebookFolderUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=48)

    @field_validator("name")
    @classmethod
    def _clean_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        label = " ".join(value.split())
        if not label:
            raise ValueError("Folder name is required")
        return label[:48]


class NotebookFolderResponse(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    name: str
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
