"""Market-data provider adapters and the registry-source -> adapter lookup."""

from __future__ import annotations

from app.services.marketdata.providers.base import Chunk, Provider, ProviderError, Throttle

__all__ = ["Chunk", "Provider", "ProviderError", "Throttle", "get_provider"]


def get_provider(source: str, *, throttle: Throttle | None = None) -> Provider:
    if source == "binance":
        from app.services.marketdata.providers.binance import BinanceProvider

        return BinanceProvider(throttle=throttle)
    if source == "dukascopy":
        from app.services.marketdata.providers.dukascopy import DukascopyProvider

        return DukascopyProvider(throttle=throttle)
    raise ProviderError("unknown_source", f"no adapter for source {source!r}", retryable=False)
