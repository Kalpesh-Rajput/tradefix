"""Network stand-in used only when ENVIRONMENT=test. It never calls a provider."""

from __future__ import annotations

from app.services.marketdata.providers.base import ProviderError
from app.services.marketdata.registry import InstrumentSpec


class FakeProvider:
    name = "fake"

    def __init__(self, source: str) -> None:
        self.source = source

    def iter_chunks(self, spec: InstrumentSpec, start_ms: int, end_ms: int):
        if spec.source != self.source:
            raise ProviderError("unknown_source", f"fake provider is for {self.source}", retryable=False)
        raise ProviderError(
            "provider_disabled",
            "ENVIRONMENT=test does not fetch from the network; seed the store instead",
            retryable=False,
        )
