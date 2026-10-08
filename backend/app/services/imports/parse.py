"""Public parse entry. Preview rows stay out of the journal until confirm."""

from __future__ import annotations

from app.services.imports.pipeline import ImportFileError, build_preview

__all__ = ["ImportFileError", "parse_upload"]


def parse_upload(filename: str, payload: bytes) -> tuple[str, list[dict]]:
    preview = build_preview(filename, payload)
    return preview.detected_format, preview.rows
