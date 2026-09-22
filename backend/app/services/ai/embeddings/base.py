from __future__ import annotations

from typing import Protocol


class EmbeddingProvider(Protocol):
    def is_configured(self) -> bool: ...

    def embed(self, texts: list[str]) -> list[list[float] | None]: ...
