from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class FxQuoteResponse(BaseModel):
    base: str
    quote: str
    rate: float
    rate_timestamp: datetime | None = None
    fetched_at: datetime
    source: str
    source_attribution: str
    delayed: bool = True
    freshness: Literal["latest", "cached", "stale"]
    cache_ttl_seconds: int


class FxCurrencyItem(BaseModel):
    code: str = Field(min_length=3, max_length=3)
    name: str
    symbol: str
    flag: str
    decimals: int = 2


class FxCurrencyListResponse(BaseModel):
    currencies: list[FxCurrencyItem]
    source: str
    delayed: bool = True
