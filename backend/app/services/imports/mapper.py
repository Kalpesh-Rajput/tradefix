"""Match spreadsheet columns to canonical trade fields."""

from __future__ import annotations

from app.services.imports.columns import normalize_column
from app.services.imports.fields import ALIASES, FIELD_ORDER


def map_columns(headers: list[str], override: dict[str, str] | None = None) -> dict[str, str]:
    if override is not None:
        return _from_override(headers, override)
    normalized = [(header, normalize_column(header)) for header in headers]
    used: set[str] = set()
    mapping: dict[str, str] = {}
    for field in FIELD_ORDER:
        for alias in ALIASES[field]:
            match = next((header for header, label in normalized if header not in used and label == alias), None)
            if match is None:
                continue
            mapping[field] = match
            used.add(match)
            break
    for field in FIELD_ORDER:
        if field in mapping:
            continue
        candidates: list[str] = []
        for header, label in normalized:
            if header in used:
                continue
            if any(_token_match(label, alias) for alias in ALIASES[field]):
                candidates.append(header)
        if len(candidates) == 1:
            mapping[field] = candidates[0]
            used.add(candidates[0])
    return mapping


def unmapped_required(mapping: dict[str, str]) -> list[str]:
    """Entry price or exit price can satisfy the price column. Same for the two times."""
    missing = [field for field in ("symbol", "side", "quantity") if field not in mapping]
    if "price" not in mapping and "exit_price" not in mapping:
        missing.append("price")
    if "executed_at" not in mapping and "closed_at" not in mapping:
        missing.append("closed_at" if "exit_price" in mapping and "price" not in mapping else "executed_at")
    return missing


def _from_override(headers: list[str], override: dict[str, str]) -> dict[str, str]:
    available = set(headers)
    mapping: dict[str, str] = {}
    used: set[str] = set()
    for field in FIELD_ORDER:
        column = str(override.get(field) or "").strip()
        if not column or column not in available or column in used:
            continue
        mapping[field] = column
        used.add(column)
    return mapping


def _token_match(label: str, alias: str) -> bool:
    if len(alias) < 4:
        return False
    return label.startswith(f"{alias}_") or label.endswith(f"_{alias}")
