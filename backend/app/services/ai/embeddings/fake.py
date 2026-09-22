from __future__ import annotations


class FakeEmbeddingProvider:
    def is_configured(self) -> bool:
        return True

    def embed(self, texts: list[str]) -> list[list[float] | None]:
        vectors: list[list[float] | None] = []
        for text in texts:
            lowered = (text or "").lower()
            vectors.append(
                [
                    1.0 if "breakout" in lowered else 0.0,
                    1.0 if "fomo" in lowered or "mistake" in lowered else 0.0,
                    1.0 if "journal" in lowered else 0.1,
                    float(len(lowered) % 7) / 7.0,
                ]
            )
        return vectors
