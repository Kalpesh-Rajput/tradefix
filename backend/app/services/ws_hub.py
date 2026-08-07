"""In-process WebSocket hub for live account/trade updates."""

from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WsHub:
    def __init__(self) -> None:
        self._rooms: dict[str, set[WebSocket]] = defaultdict(set)
        self._loop: asyncio.AbstractEventLoop | None = None

    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    async def connect(self, user_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._rooms[user_id].add(ws)

    def disconnect(self, user_id: str, ws: WebSocket) -> None:
        self._rooms[user_id].discard(ws)

    async def publish(self, user_id: str, payload: dict[str, Any]) -> None:
        dead: list[WebSocket] = []
        message = json.dumps(payload)
        for ws in list(self._rooms.get(user_id, [])):
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._rooms[user_id].discard(ws)

    def publish_sync(self, user_id: str, payload: dict[str, Any]) -> None:
        loop = self._loop
        if loop is None or not loop.is_running():
            return
        asyncio.run_coroutine_threadsafe(self.publish(user_id, payload), loop)


hub = WsHub()
