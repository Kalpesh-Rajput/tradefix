"""Provider adapter contract (backtesting/02 sections 6 and 7).

An adapter yields `Chunk`s in time order. Each chunk states the exact [start, end) range the provider
was asked for and answered, so the caller can mark it covered after writing, and can stop between
chunks for cancellation.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Iterator, Protocol

from app.services.marketdata.candles import Candles
from app.services.marketdata.registry import InstrumentSpec

Throttle = Callable[[], None]


def no_throttle() -> None:
    return None


@dataclass(frozen=True)
class Chunk:
    start_ms: int
    end_ms: int
    candles: Candles
    via: str


class ProviderError(Exception):
    """A fetch failure with a stable code. `retryable` tells the job runner whether to back off and retry."""

    def __init__(self, code: str, message: str, *, retryable: bool = True, retry_after_s: float | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.retryable = retryable
        self.retry_after_s = retry_after_s


class Provider(Protocol):
    name: str

    def iter_chunks(self, spec: InstrumentSpec, start_ms: int, end_ms: int) -> Iterator[Chunk]: ...
