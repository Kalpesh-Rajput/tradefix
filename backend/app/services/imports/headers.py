"""Pick the header row when a broker file starts with a title or account block."""

from __future__ import annotations

from app.services.imports.columns import normalize_column
from app.services.imports.fields import ALIASES

_KNOWN = {alias for aliases in ALIASES.values() for alias in aliases}
_SCAN_ROWS = 30
_MIN_SCORE = 2


def detect_header_index(grid: list[tuple[int, list[str]]]) -> int:
    """Return the index into `grid` of the header row. Defaults to the first row."""
    best_index = 0
    best_score = -1
    for index, (_, cells) in enumerate(grid[:_SCAN_ROWS]):
        score = _score(cells)
        if score > best_score:
            best_score = score
            best_index = index
    if best_score < _MIN_SCORE:
        return 0
    return best_index


def _score(cells: list[str]) -> int:
    labels = [normalize_column(cell) for cell in cells if cell.strip()]
    if len(labels) < 2:
        return 0
    known = sum(1 for label in labels if label in _KNOWN)
    unique = len(set(labels))
    if unique < len(labels):
        known -= 1
    return known
