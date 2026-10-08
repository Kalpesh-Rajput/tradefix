"""Parse broker cell text into canonical trade values."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

_BUY = {"buy", "b", "long", "l"}
_SELL = {"sell", "s", "short"}
_BLANK = {"", "-", "—", "n/a", "na", "null", "none"}
_UNAMBIGUOUS = (
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d %H:%M",
    "%Y-%m-%d",
    "%Y.%m.%d %H:%M:%S",
    "%Y.%m.%d %H:%M",
    "%Y.%m.%d",
    "%Y/%m/%d %H:%M:%S",
    "%Y/%m/%d %H:%M",
    "%Y/%m/%d",
    "%d.%m.%Y %H:%M:%S",
    "%d.%m.%Y %H:%M",
    "%d.%m.%Y",
    "%d %b %Y %H:%M:%S",
    "%d %b %Y %H:%M",
    "%d %b %Y",
    "%b %d %Y %H:%M:%S",
    "%b %d, %Y %H:%M:%S",
    "%b %d %Y",
)
_DAY_FIRST = (
    "%d/%m/%Y %H:%M:%S",
    "%d/%m/%Y %H:%M",
    "%d/%m/%Y",
    "%d-%m-%Y %H:%M:%S",
    "%d-%m-%Y %H:%M",
    "%d-%m-%Y",
)
_MONTH_FIRST = (
    "%m/%d/%Y %H:%M:%S",
    "%m/%d/%Y %H:%M",
    "%m/%d/%Y",
    "%m-%d-%Y %H:%M:%S",
    "%m-%d-%Y",
)
_SLASH_DATE = re.compile(r"^(\d{1,2})[/-](\d{1,2})[/-](\d{4})")


def normalize_values(raw: dict[str, str], mapping: dict[str, str]) -> tuple[dict[str, str | None], list[str]]:
    errors: list[str] = []
    normalized: dict[str, str | None] = {
        "symbol": _symbol(_cell(raw, mapping, "symbol")),
        "side": _side(_cell(raw, mapping, "side"), errors),
        "quantity": _number(_cell(raw, mapping, "quantity"), "quantity", errors),
        "price": _number(_cell(raw, mapping, "price"), "entry price", errors),
        "exit_price": _optional_number(_cell(raw, mapping, "exit_price"), "exit price", errors),
        "executed_at": _optional_time(_cell(raw, mapping, "executed_at"), "open time", errors),
        "closed_at": _optional_time(_cell(raw, mapping, "closed_at"), "close time", errors),
        "commission": _optional_number(_cell(raw, mapping, "commission"), "commission", errors),
        "swap": _optional_number(_cell(raw, mapping, "swap"), "swap", errors),
        "external_id": _text(_cell(raw, mapping, "external_id")),
        "notes": _text(_cell(raw, mapping, "notes")),
        "pnl": _optional_number(_cell(raw, mapping, "pnl"), "p&l", errors),
    }
    return normalized, errors


def _cell(raw: dict[str, str], mapping: dict[str, str], field: str) -> str:
    column = mapping.get(field)
    if not column:
        return ""
    value = raw.get(column)
    return "" if value is None else str(value).strip()


def _symbol(value: str) -> str | None:
    text = re.sub(r"\s+", "", value).upper()
    return text or None


def _side(value: str, errors: list[str]) -> str | None:
    text = value.strip().lower()
    if text in _BLANK:
        return None
    if text in _BUY:
        return "buy"
    if text in _SELL:
        return "sell"
    errors.append("side was not understood")
    return None


def _number(value: str, label: str, errors: list[str]) -> str | None:
    if value.strip().lower() in _BLANK:
        return None
    parsed = _decimal(value)
    if parsed is None:
        errors.append(f"{label} is not a number")
        return None
    return format(parsed, "f")


def _optional_number(value: str, label: str, errors: list[str]) -> str | None:
    if value.strip().lower() in _BLANK:
        return None
    return _number(value, label, errors)


def _optional_time(value: str, label: str, errors: list[str]) -> str | None:
    if value.strip().lower() in _BLANK:
        return None
    try:
        return _parse_dt(value).isoformat()
    except ValueError:
        errors.append(f"{label} was not understood")
        return None


def _text(value: str) -> str | None:
    text = value.strip()
    return text or None


def _decimal(value: str) -> Decimal | None:
    text = value.strip()
    negative = text.startswith("(") and text.endswith(")")
    text = text.strip("()")
    text = text.replace(",", "").replace(" ", "")
    text = re.sub(r"^[^\d.+-]+", "", text)
    text = re.sub(r"[^\d.]+$", "", text)
    if not text:
        return None
    try:
        number = Decimal(text)
    except InvalidOperation:
        return None
    return -number if negative else number


def _parse_dt(value: str) -> datetime:
    text = value.strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        parsed = None
    if parsed is not None:
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    for fmt in _UNAMBIGUOUS:
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    match = _SLASH_DATE.match(text)
    formats = _DAY_FIRST
    if match:
        first = int(match.group(1))
        second = int(match.group(2))
        if first <= 12 and second > 12:
            formats = _MONTH_FIRST
    for fmt in formats:
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    raise ValueError(text)
