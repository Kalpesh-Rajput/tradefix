from typing import Literal
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response

from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.media import GiphySearchResponse
from app.services.giphy_service import is_allowed_media_url, search_giphy
from app.services.rate_limit import giphy_proxy_limiter, giphy_search_limiter

router = APIRouter(prefix="/api/media", tags=["media"])

Kind = Literal["gifs", "stickers"]


@router.get("/giphy", response_model=GiphySearchResponse)
async def giphy_search(
    q: str = Query("", max_length=50),
    kind: Kind = Query("gifs"),
    current_user: User = Depends(get_current_user),
):
    giphy_search_limiter.check(str(current_user.id))
    return await search_giphy(kind, q)


@router.get("/proxy")
async def proxy_giphy_image(
    url: str = Query(..., max_length=500),
    current_user: User = Depends(get_current_user),
):
    giphy_proxy_limiter.check(str(current_user.id))
    parsed = urlparse(url)
    if not is_allowed_media_url(url) or not parsed.scheme.startswith("http"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported media host")

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            response = await client.get(url, headers={"User-Agent": "TradeFix/1.0"})
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not load media",
        ) from exc

    content_type = response.headers.get("content-type", "image/gif")
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Not an image")
    if len(response.content) > 8 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Image too large")

    return Response(
        content=response.content,
        media_type=content_type.split(";")[0],
        headers={"Cache-Control": "private, max-age=86400"},
    )
