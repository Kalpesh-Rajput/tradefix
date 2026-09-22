from __future__ import annotations

import logging

from app.core.config import settings
from app.services.ai.openrouter_client import get_embedding_client

logger = logging.getLogger(__name__)


class OpenRouterEmbeddingProvider:
    def is_configured(self) -> bool:
        return bool(settings.openrouter_api_key and settings.openrouter_embedding_model)

    def embed(self, texts: list[str]) -> list[list[float] | None]:
        if not texts:
            return []
        if not self.is_configured():
            return [None for _ in texts]
        try:
            response = get_embedding_client().embeddings.create(
                model=settings.openrouter_embedding_model,
                input=texts,
            )
        except Exception:
            logger.exception("OpenRouter embeddings failed")
            return [None for _ in texts]
        by_index: dict[int, list[float]] = {}
        for item in getattr(response, "data", None) or []:
            idx = getattr(item, "index", None)
            vector = getattr(item, "embedding", None)
            if isinstance(idx, int) and isinstance(vector, list):
                by_index[idx] = [float(v) for v in vector]
        return [by_index.get(i) for i in range(len(texts))]
