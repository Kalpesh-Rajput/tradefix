"""Check that a normalized row can become a journal fill."""

from __future__ import annotations

from decimal import Decimal

_LABELS = {
    "symbol": "symbol",
    "side": "side",
    "quantity": "quantity",
}


def validate_trade(normalized: dict[str, str | None], errors: list[str]) -> tuple[str, list[str]]:
    found = list(errors)
    for field, label in _LABELS.items():
        if not normalized.get(field):
            _add(found, f"{label} is missing")
    _positive(normalized.get("quantity"), "quantity", found)
    _positive(normalized.get("price"), "entry price", found)
    _positive(normalized.get("exit_price"), "exit price", found)
    _require_price(normalized, found)
    return ("attention" if found else "valid"), found


def _require_price(normalized: dict[str, str | None], found: list[str]) -> None:
    """A row is an entry, an exit, or both. A sell with only an exit price is the close."""
    has_entry = bool(normalized.get("price"))
    has_exit = bool(normalized.get("exit_price"))
    if has_entry:
        if not normalized.get("executed_at"):
            _add(found, "open time is missing")
        return
    if has_exit and normalized.get("side") == "sell":
        if not normalized.get("closed_at"):
            _add(found, "close time is missing")
        return
    if normalized.get("side") == "sell":
        if not _mentions(found, "exit price"):
            _add(found, "exit price is missing")
        if not normalized.get("closed_at") and not normalized.get("executed_at"):
            _add(found, "close time is missing")
        return
    if not _mentions(found, "entry price"):
        _add(found, "entry price is missing")
    if not normalized.get("executed_at"):
        _add(found, "open time is missing")


def _mentions(found: list[str], label: str) -> bool:
    return any(label in item for item in found)


def _add(found: list[str], message: str) -> None:
    if message not in found:
        found.append(message)


def _positive(value: str | None, label: str, errors: list[str]) -> None:
    if not value:
        return
    try:
        number = Decimal(value)
    except Exception:  # noqa: BLE001
        return
    if number <= 0:
        errors.append(f"{label} must be greater than zero")
