from __future__ import annotations

import uuid
from dataclasses import dataclass, field

from sqlalchemy.orm import Session


@dataclass
class SourceRef:
    type: str
    id: str
    title: str
    date: str | None = None
    url: str | None = None
    snippet: str | None = None
    publisher: str | None = None

    def as_dict(self) -> dict:
        payload = {"type": self.type, "id": self.id, "title": self.title}
        if self.date:
            payload["date"] = self.date
        if self.url:
            payload["url"] = self.url
        if self.snippet:
            payload["snippet"] = self.snippet
        if self.publisher:
            payload["publisher"] = self.publisher
        return payload


@dataclass
class ToolContext:
    db: Session
    user_id: uuid.UUID
    account_id: uuid.UUID | None = None
    sources: list[SourceRef] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def add_source(self, source: SourceRef) -> None:
        if any(existing.id == source.id and existing.type == source.type for existing in self.sources):
            return
        self.sources.append(source)
