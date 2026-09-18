from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.fx import FxCurrencyItem, FxCurrencyListResponse, FxQuoteResponse
from app.services import fx_service
from app.services.rate_limit import SlidingWindowRateLimiter

router = APIRouter(prefix="/api/fx", tags=["fx"])

fx_refresh_limiter = SlidingWindowRateLimiter(
    max_calls=20,
    window_seconds=600,
    detail="Too many rate refreshes. Please wait and try again.",
)


@router.get("/quote", response_model=FxQuoteResponse)
def get_quote(
    base: str = Query(..., min_length=3, max_length=3),
    quote: str = Query(..., min_length=3, max_length=3),
    refresh: bool = False,
    current_user: User = Depends(get_current_user),
):
    if refresh:
        fx_refresh_limiter.check(str(current_user.id))
    data = fx_service.get_quote(base, quote, force_refresh=refresh)
    return FxQuoteResponse(
        base=data.base,
        quote=data.quote,
        rate=data.rate,
        rate_timestamp=data.rate_timestamp,
        fetched_at=data.fetched_at,
        source=data.source,
        source_attribution=data.attribution,
        delayed=data.delayed,
        freshness=data.freshness,
        cache_ttl_seconds=data.cache_ttl_seconds,
    )


@router.get("/currencies", response_model=FxCurrencyListResponse)
def list_currencies(current_user: User = Depends(get_current_user)):
    items = [FxCurrencyItem(**row) for row in fx_service.list_currencies()]
    return FxCurrencyListResponse(
        currencies=items,
        source="ExchangeRate-API",
        delayed=True,
    )
