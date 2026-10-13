"""Validation for per-user custom theme documents.

Token keys are a safe identifier pattern rather than a frozen allow-list so a
newer client can save a token this server does not know yet. Values must still
be colors. Built-in theme ids are never accepted as custom theme ids.
"""

from __future__ import annotations

import re
from typing import Any

from pydantic import BaseModel, Field, field_validator

CUSTOM_THEME_LIMIT = 12
CUSTOM_THEME_NAME_MAX = 48
SCHEMA_VERSION = 1

_THEME_ID = re.compile(r"^ct_[a-f0-9]{12}$")
_TOKEN_KEY = re.compile(r"^[a-z][A-Za-z0-9]{0,48}$")
_HEX = re.compile(r"^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$")
_RGB = re.compile(
    r"^rgba?\(\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$"
)
_BASE_THEMES = {
    "tradefix-purple",
    "classic",
    "midnight-pro",
    "ocean-blue",
    "forest-green",
    "amethyst",
    "warm-sand",
    "obsidian-gold",
    "emerald-luxe",
    "burgundy-champagne",
    "violet-aurora",
    "electric-spectrum",
}
_BUILTIN_THEMES = _BASE_THEMES | {"system", "light", "dark"}


def is_custom_theme_id(value: str) -> bool:
    return bool(_THEME_ID.fullmatch(value))


def is_allowed_theme_value(value: str) -> bool:
    return value in _BUILTIN_THEMES or is_custom_theme_id(value)


class CustomThemePayload(BaseModel):
    id: str
    name: str = Field(min_length=1, max_length=CUSTOM_THEME_NAME_MAX)
    base_theme_id: str
    mode: str
    tokens: dict[str, str]
    schema_version: int = SCHEMA_VERSION

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        if not is_custom_theme_id(value):
            raise ValueError("Invalid custom theme id")
        return value

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned or len(cleaned) > CUSTOM_THEME_NAME_MAX:
            raise ValueError("Invalid theme name")
        return cleaned

    @field_validator("base_theme_id")
    @classmethod
    def validate_base(cls, value: str) -> str:
        if value not in _BASE_THEMES:
            raise ValueError("Invalid base theme")
        return value

    @field_validator("mode")
    @classmethod
    def validate_mode(cls, value: str) -> str:
        if value not in {"light", "dark"}:
            raise ValueError("Invalid theme mode")
        return value

    @field_validator("schema_version")
    @classmethod
    def validate_schema(cls, value: int) -> int:
        if value != SCHEMA_VERSION:
            raise ValueError("Unsupported custom theme schema")
        return value

    @field_validator("tokens")
    @classmethod
    def validate_tokens(cls, value: dict[str, str]) -> dict[str, str]:
        if len(value) > 160:
            raise ValueError("Too many theme colors")
        for key, color in value.items():
            if not _TOKEN_KEY.fullmatch(key):
                raise ValueError(f"Invalid color token {key}")
            if not isinstance(color, str) or not (_HEX.fullmatch(color) or _RGB.fullmatch(color)):
                raise ValueError(f"Invalid color for {key}")
        return value


class CustomThemesDocument(BaseModel):
    revision: int = Field(ge=0)
    themes: list[CustomThemePayload] = Field(default_factory=list, max_length=CUSTOM_THEME_LIMIT)

    @field_validator("themes")
    @classmethod
    def validate_unique(cls, value: list[CustomThemePayload]) -> list[CustomThemePayload]:
        ids: set[str] = set()
        names: set[str] = set()
        for theme in value:
            if theme.id in ids:
                raise ValueError("Duplicate custom theme id")
            ids.add(theme.id)
            folded = theme.name.casefold()
            if folded in names:
                raise ValueError("Duplicate custom theme name")
            names.add(folded)
        return value


def stored_document(current: Any, incoming: CustomThemesDocument) -> dict[str, Any]:
    current_revision = 0
    if isinstance(current, dict):
        raw = current.get("revision", 0)
        if isinstance(raw, int) and raw >= 0:
            current_revision = raw
    if incoming.revision != current_revision:
        raise ValueError("revision")
    return {
        "revision": current_revision + 1,
        "themes": [theme.model_dump() for theme in incoming.themes],
    }


def theme_ids(document: Any) -> set[str]:
    if not isinstance(document, dict):
        return set()
    themes = document.get("themes")
    if not isinstance(themes, list):
        return set()
    return {item["id"] for item in themes if isinstance(item, dict) and isinstance(item.get("id"), str)}
