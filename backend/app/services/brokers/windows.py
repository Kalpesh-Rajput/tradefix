"""Split a history range into provider windows. No unbounded loops."""

from __future__ import annotations

from datetime import datetime, timedelta


def chunk_range(start: datetime, end: datetime, *, window: timedelta) -> list[tuple[datetime, datetime]]:
    if window.total_seconds() <= 0:
        raise ValueError("window must be positive")
    if end < start:
        return []
    chunks: list[tuple[datetime, datetime]] = []
    cursor = start
    while cursor < end:
        nxt = min(cursor + window, end)
        chunks.append((cursor, nxt))
        if nxt == cursor:
            break
        cursor = nxt
        if len(chunks) > 10000:
            raise ValueError("history range produced too many windows")
    return chunks
