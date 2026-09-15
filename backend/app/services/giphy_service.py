"""Giphy search with a tagged catalog fallback so share-styling works without a key."""

from __future__ import annotations

from typing import Literal

import httpx

from app.core.config import settings
from app.schemas.media import GiphyMediaItem, GiphySearchResponse

Kind = Literal["gifs", "stickers"]

_GIPHY_HOSTS = {
    "media.giphy.com",
    "media0.giphy.com",
    "media1.giphy.com",
    "media2.giphy.com",
    "media3.giphy.com",
    "media4.giphy.com",
    "i.giphy.com",
}

# Public Giphy media IDs used when GIPHY_API_KEY is unset or the live search fails.
_CATALOG: list[tuple[str, str, Kind, tuple[str, ...]]] = [
    ("l0HlNQ03J5JxX6lva", "Make it rain", "gifs", ("rain", "money", "cash", "make it rain")),
    ("xT9IgG50FyckxPxREo", "Cash toss", "gifs", ("money", "cash", "rain", "make it rain")),
    ("3o6ZtpxSZbQRRtwAEM", "Money stack", "gifs", ("money", "cash", "win")),
    ("26tknCpeJkfmqVY9i", "Throwing cash", "gifs", ("money", "cash", "rain", "make it rain")),
    ("Is1O1TWV0LEJi", "Payday", "gifs", ("money", "cash", "win", "celebrate")),
    ("3oEjI6SIIHBdRxXI40", "Applause", "gifs", ("clap", "win", "celebrate")),
    ("26u4cqi2I30juCOGY", "Cheers", "gifs", ("cheers", "celebrate", "win")),
    ("artP2jFysI0qk", "Excited", "gifs", ("excited", "win", "yes")),
    ("111ebonMs90YLu", "Yes", "gifs", ("yes", "win", "excited")),
    ("yoJC2GnSClbPOkV0eA", "Thumbs up", "gifs", ("yes", "win", "good")),
    ("l0MYt5jPR6QX5pnqM", "Confetti cash", "gifs", ("confetti", "money", "celebrate")),
    ("26ufcVAuq4qtQny5G", "Confetti", "gifs", ("confetti", "celebrate", "party")),
    ("3ohzdIuqJoo8QdKlnW", "On fire", "gifs", ("fire", "hot", "win")),
    ("5GoVLqeAOo6PK", "Disappear", "gifs", ("funny", "bye")),
    ("d3mlE7uhX8KFgEmY", "Success", "gifs", ("success", "win", "yes")),
    ("3o7abldj0bQyAKtdvO", "Clapping", "gifs", ("clap", "win", "celebrate")),
    ("l0MYzH6y7yQFUVY3C", "Party", "gifs", ("party", "celebrate", "dance")),
    ("xTiTnnKjM6rUksNzPa", "Dance", "gifs", ("dance", "celebrate", "win")),
    ("26tPplGWjN0xLybiU", "Winner", "gifs", ("win", "trophy", "champion")),
    ("3ohzdIuqJoo8QdKlnW", "Fire", "stickers", ("fire", "hot", "win")),
    ("3o7aCTPPm4OHfRLSH6", "Heart eyes", "stickers", ("love", "win")),
    ("3o6gDP9oF2hPjT8NVe", "100", "stickers", ("100", "win", "perfect")),
    ("l0MYC0LajbaPoEADu", "Star", "stickers", ("star", "win")),
    ("3ohzdIuqJoo8QdKlnW", "Flame", "stickers", ("fire", "hot")),
]


def giphy_url(gif_id: str, size: str) -> str:
    return f"https://media.giphy.com/media/{gif_id}/{size}"


def is_allowed_media_url(url: str) -> bool:
    from urllib.parse import urlparse

    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme not in {"http", "https"}:
        return False
    return host in _GIPHY_HOSTS or host.endswith(".giphy.com")


def _catalog_item(gif_id: str, title: str, kind: Kind) -> GiphyMediaItem:
    return GiphyMediaItem(
        id=gif_id,
        title=title,
        preview_url=giphy_url(gif_id, "200.gif"),
        url=giphy_url(gif_id, "giphy.gif"),
        width=200,
        height=200,
        kind=kind,
    )


def search_catalog(kind: Kind, query: str) -> list[GiphyMediaItem]:
    q = query.strip().lower()
    out: list[GiphyMediaItem] = []
    seen: set[str] = set()
    for gif_id, title, item_kind, tags in _CATALOG:
        if item_kind != kind:
            continue
        hay = f"{title} {' '.join(tags)}".lower()
        if q and q not in hay and not any(q in tag for tag in tags):
            continue
        if gif_id in seen:
            continue
        seen.add(gif_id)
        out.append(_catalog_item(gif_id, title, kind))
    if q and not out:
        # Prefer money/celebration results over an empty grid.
        return search_catalog(kind, "")
    return out[:24]


def _parse_giphy_payload(payload: dict, kind: Kind) -> list[GiphyMediaItem]:
    items: list[GiphyMediaItem] = []
    for raw in payload.get("data") or []:
        images = raw.get("images") or {}
        preview = (images.get("fixed_width_small") or images.get("preview_gif") or {}).get("url")
        full = (images.get("downsized") or images.get("original") or {}).get("url")
        original = images.get("original") or {}
        if not preview or not full:
            continue
        try:
            width = int(original.get("width") or 200)
            height = int(original.get("height") or 200)
        except (TypeError, ValueError):
            width, height = 200, 200
        items.append(
            GiphyMediaItem(
                id=str(raw.get("id") or full),
                title=str(raw.get("title") or "GIF"),
                preview_url=preview,
                url=full,
                width=max(1, width),
                height=max(1, height),
                kind=kind,
            )
        )
    return items


async def search_giphy(kind: Kind, query: str) -> GiphySearchResponse:
    api_key = (settings.giphy_api_key or "").strip()
    if not api_key:
        return GiphySearchResponse(items=search_catalog(kind, query), source="catalog")

    path = "gifs" if kind == "gifs" else "stickers"
    endpoint = "search" if query.strip() else "trending"
    params: dict[str, str | int] = {
        "api_key": api_key,
        "limit": 24,
        "rating": "pg",
        "lang": "en",
    }
    if endpoint == "search":
        params["q"] = query.strip()[:50]

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"https://api.giphy.com/v1/{path}/{endpoint}", params=params)
            response.raise_for_status()
            items = _parse_giphy_payload(response.json(), kind)
    except httpx.HTTPError:
        return GiphySearchResponse(items=search_catalog(kind, query), source="catalog")

    if not items:
        return GiphySearchResponse(items=search_catalog(kind, query), source="catalog")
    return GiphySearchResponse(items=items, source="giphy")
