"""Turn spreadsheet headers into comparable labels."""

from __future__ import annotations

import re

_NON_ALNUM = re.compile(r"[^a-z0-9]+")
_PARENS = re.compile(r"\([^)]*\)")


def normalize_column(label: str) -> str:
    text = label.strip().lower().replace("&", " and ")
    text = _PARENS.sub(" ", text)
    text = _NON_ALNUM.sub("_", text)
    return text.strip("_")
