from typing import Literal

from pydantic import BaseModel, Field


class GiphyMediaItem(BaseModel):
    id: str
    title: str
    preview_url: str
    url: str
    width: int = 200
    height: int = 200
    kind: Literal["gifs", "stickers"] = "gifs"


class GiphySearchResponse(BaseModel):
    items: list[GiphyMediaItem] = Field(default_factory=list)
    source: Literal["giphy", "catalog"] = "catalog"
