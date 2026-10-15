"""Min/max downsampling that keeps the first point, the last point, and the extremes."""

from __future__ import annotations


def downsample_minmax(points: list[tuple[int, float]], limit: int) -> list[tuple[int, float]]:
    if limit < 2 or len(points) <= limit:
        return list(points)
    buckets = max(1, limit // 2)
    size = len(points) / buckets
    kept: list[tuple[int, float]] = []
    for index in range(buckets):
        start = int(index * size)
        end = int((index + 1) * size) if index < buckets - 1 else len(points)
        window = points[start:end]
        if not window:
            continue
        low = min(window, key=lambda item: item[1])
        high = max(window, key=lambda item: item[1])
        for item in sorted((low, high), key=lambda item: item[0]):
            if not kept or kept[-1][0] != item[0]:
                kept.append(item)
    if not kept or kept[0][0] != points[0][0]:
        kept.insert(0, points[0])
    if kept[-1][0] != points[-1][0]:
        kept.append(points[-1])
    if len(kept) <= limit:
        return kept
    must = {kept[0][0], kept[-1][0], min(kept, key=lambda item: item[1])[0], max(kept, key=lambda item: item[1])[0]}
    middle = [item for item in kept if item[0] not in must]
    room = max(0, limit - len(must))
    step = max(1, len(middle) // room) if room else 1
    chosen = {item[0] for item in (middle[::step][:room] if room else [])}
    return [item for item in kept if item[0] in must or item[0] in chosen]
