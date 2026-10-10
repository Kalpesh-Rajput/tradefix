"""Match spreadsheet columns to canonical trade fields."""

from __future__ import annotations

import re

from app.services.imports.columns import normalize_column
from app.services.imports.fields import ALIASES, FIELD_KIND, FIELD_ORDER
from app.services.imports.values import is_datetime_text, is_number_text, number_text

_MIN_SCORE = 6
_SAMPLE_ROWS = 40

# Kinds that are safe to assign from cell values when the header is unknown.
_VALUE_ONLY = {
    "side",
    "symbol",
    "executed_at",
    "closed_at",
    "notes",
    "emotions",
    "pnl",
    "strategy",
    "rules_broken",
    "session",
    "asset_type",
    "analysis_timeframe",
    "option_type",
}

_SIDES = {"buy", "sell", "long", "short", "b", "s"}
_EMOTIONS = {
    "calm",
    "neutral",
    "calm/neutral",
    "confident",
    "focused",
    "patient",
    "anxious",
    "fomo",
    "revenge",
    "revenge trading",
    "frustrated",
    "excited",
    "bored",
    "overconfident",
    "fearful",
    "fear",
    "greedy",
    "greed",
    "hesitant",
    "tilted",
    "hopeful",
    "stressed",
    "tired",
    "disciplined",
    "impatient",
    "euphoric",
}
_STRATEGIES = {
    "breakout",
    "trend following",
    "mean reversion",
    "scalping",
    "scalp",
    "swing trade",
    "swing",
    "momentum",
    "gap fill",
    "support/resistance",
    "news/catalyst",
    "earnings play",
    "options spread",
    "reversal",
}
_MISTAKES = {
    "broke rules",
    "fomo entry",
    "revenge trading",
    "overtrading",
    "ignored stop loss",
    "moved stop loss",
    "position too large",
    "exited too early",
    "exited too late",
    "chased entry",
    "no trading plan",
    "emotional decision",
    "poor risk/reward",
    "wrong timeframe",
    "ignored signals",
}
_SESSIONS = {
    "london",
    "new york",
    "newyork",
    "ny",
    "asia",
    "tokyo",
    "sydney",
    "overlap",
    "premarket",
    "after hours",
    "us",
    "european",
}
_ASSETS = {
    "stock",
    "stocks",
    "equity",
    "option",
    "options",
    "future",
    "futures",
    "forex",
    "fx",
    "crypto",
    "cryptocurrency",
}
_NOT_SYMBOL = _EMOTIONS | _SIDES | _STRATEGIES | _MISTAKES | _SESSIONS | _ASSETS
_TIMEFRAME = re.compile(
    r"^(\d+\s?(m|min|mins|h|hr|hour|d|day|w|week)s?|[mhd]\d+|daily|weekly|monthly|h1|h4|m1|m5|m15|m30|d1|w1)$",
    re.IGNORECASE,
)
_QUOTES = ("USDT", "USDC", "USD", "EUR", "GBP", "JPY", "BTC", "ETH")


def map_columns(
    headers: list[str],
    override: dict[str, str] | None = None,
    samples: list[dict[str, str]] | None = None,
) -> dict[str, str]:
    if override is not None:
        return _from_override(headers, override)
    normalized = [(header, normalize_column(header)) for header in headers]
    used: set[str] = set()
    mapping: dict[str, str] = {}
    _assign_exact(normalized, used, mapping)
    _assign_tokens(normalized, used, mapping)
    _assign_from_values(normalized, used, mapping, samples or [])
    return mapping


def unmapped_required(mapping: dict[str, str]) -> list[str]:
    """Entry price or exit price can satisfy the price column. Same for the two times."""
    missing = [field for field in ("symbol", "side", "quantity") if field not in mapping]
    if "price" not in mapping and "exit_price" not in mapping:
        missing.append("price")
    if "executed_at" not in mapping and "closed_at" not in mapping:
        missing.append("closed_at" if "exit_price" in mapping and "price" not in mapping else "executed_at")
    return missing


def _assign_exact(normalized: list[tuple[str, str]], used: set[str], mapping: dict[str, str]) -> None:
    for field in FIELD_ORDER:
        for alias in ALIASES[field]:
            match = next((header for header, label in normalized if header not in used and label == alias), None)
            if match is None:
                continue
            mapping[field] = match
            used.add(match)
            break


def _assign_tokens(normalized: list[tuple[str, str]], used: set[str], mapping: dict[str, str]) -> None:
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


def _assign_from_values(
    normalized: list[tuple[str, str]],
    used: set[str],
    mapping: dict[str, str],
    samples: list[dict[str, str]],
) -> None:
    unused = [(header, label) for header, label in normalized if header not in used]
    if not unused or not samples:
        return
    values = {
        header: _column_values(header, samples)
        for header, _label in unused
    }
    ranked: list[tuple[int, int, str, str]] = []
    for field_index, field in enumerate(FIELD_ORDER):
        if field in mapping:
            continue
        for header, label in unused:
            score = _score_column(field, label, values.get(header) or [])
            if score >= _MIN_SCORE:
                ranked.append((score, field_index, header, field))
    ranked.sort(key=lambda item: (-item[0], item[1]))
    taken_fields: set[str] = set()
    taken_headers: set[str] = set()
    for _score, _index, header, field in ranked:
        if field in taken_fields or header in taken_headers:
            continue
        mapping[field] = header
        taken_fields.add(field)
        taken_headers.add(header)
        used.add(header)


def _column_values(header: str, samples: list[dict[str, str]]) -> list[str]:
    found: list[str] = []
    for row in samples[:_SAMPLE_ROWS]:
        value = str(row.get(header) or "").strip()
        if not value or value.lower() in {"-", "—", "n/a", "na", "null", "none"}:
            continue
        found.append(value)
    return found


def _score_column(field: str, label: str, values: list[str]) -> int:
    if not values:
        return 0
    name = _name_score(field, label)
    kind_score = _kind_score(FIELD_KIND[field], values)
    if name and kind_score:
        return name + kind_score
    if kind_score >= 8 and field in _VALUE_ONLY:
        return kind_score
    if name >= 7:
        return name
    return 0


def _name_score(field: str, label: str) -> int:
    best = 0
    for alias in ALIASES[field]:
        if label == alias:
            best = max(best, 10)
        elif _token_match(label, alias):
            best = max(best, 7)
        elif len(alias) >= 4 and len(label) >= 4 and (alias in label or label in alias):
            best = max(best, 5)
    return best


def _kind_score(kind: str, values: list[str]) -> int:
    if kind == "side":
        return 8 if _ratio(values, lambda value: value.strip().lower() in _SIDES) >= 0.75 else 0
    if kind == "datetime":
        return 8 if _ratio(values, is_datetime_text) >= 0.75 else 0
    if kind == "emotion":
        return 8 if _ratio(values, _is_emotion) >= 0.6 else 0
    if kind == "prose":
        return 8 if _ratio(values, _is_prose) >= 0.5 else 0
    if kind == "symbol":
        return 8 if _ratio(values, _is_symbol) >= 0.75 else 0
    if kind == "session":
        return 8 if _ratio(values, lambda value: value.strip().lower() in _SESSIONS) >= 0.6 else 0
    if kind == "asset":
        return 8 if _ratio(values, lambda value: value.strip().lower() in _ASSETS) >= 0.6 else 0
    if kind == "timeframe":
        return 8 if _ratio(values, lambda value: bool(_TIMEFRAME.match(value.strip()))) >= 0.6 else 0
    if kind == "option":
        return 8 if _ratio(values, lambda value: value.strip().lower() in {"call", "put"}) >= 0.6 else 0
    if kind == "strategy":
        return 8 if _ratio(values, lambda value: value.strip().lower() in _STRATEGIES) >= 0.6 else 0
    if kind == "mistake":
        return 8 if _ratio(values, lambda value: value.strip().lower() in _MISTAKES) >= 0.6 else 0
    if kind == "signed":
        numbers = [number_text(value) for value in values]
        if not numbers or any(number is None for number in numbers):
            return 0
        if any(number < 0 for number in numbers):
            return 8
        return 3
    if kind == "number":
        return 4 if _ratio(values, is_number_text) >= 0.75 else 0
    if kind == "id":
        return 4 if _ratio(values, lambda value: value.strip().isdigit() and len(value.strip()) >= 3) >= 0.75 else 0
    if kind == "rating":
        return 4 if _ratio(values, _is_rating) >= 0.75 else 0
    return 0


def _ratio(values: list[str], predicate) -> float:
    if not values:
        return 0.0
    return sum(1 for value in values if predicate(value)) / len(values)


def _is_emotion(value: str) -> bool:
    text = value.strip().lower()
    if text in _EMOTIONS:
        return True
    parts = [part.strip().lower() for part in re.split(r"[,;|]", text) if part.strip()]
    return bool(parts) and all(part in _EMOTIONS for part in parts)


def _is_prose(value: str) -> bool:
    text = value.strip()
    return len(text) >= 12 and " " in text and not _is_emotion(text)


def _is_symbol(value: str) -> bool:
    text = re.sub(r"[\s_./-]", "", value).upper()
    if not text or text.lower() in _NOT_SYMBOL or not re.search(r"[A-Z]", text):
        return False
    if not re.fullmatch(r"[A-Z0-9]{1,12}", text):
        return False
    if text.isalpha() and 1 <= len(text) <= 6:
        return True
    if any(text.endswith(quote) and len(text) > len(quote) for quote in _QUOTES):
        return True
    return bool(re.search(r"\d", text))


def _is_rating(value: str) -> bool:
    number = number_text(value)
    return number is not None and number == int(number) and 1 <= number <= 10


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
