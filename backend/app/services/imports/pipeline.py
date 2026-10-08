"""Run a broker file through parse → map → normalize → validate."""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from app.services.imports.duplicates import mark_duplicates
from app.services.imports.mapper import map_columns
from app.services.imports.parser import ImportFileError, ParsedFile, parse_file
from app.services.imports.validate import validate_trade
from app.services.imports.values import normalize_values

__all__ = ["ImportFileError", "ImportPreview", "build_preview", "reprocess_rows", "summarize"]


@dataclass
class ImportPreview:
    detected_format: str
    headers: list[str]
    mapping: dict[str, str]
    rows: list[dict] = field(default_factory=list)


def build_preview(filename: str, payload: bytes) -> ImportPreview:
    parsed = parse_file(filename, payload)
    if parsed.prebuilt is not None:
        mapping = map_columns(parsed.headers)
        return ImportPreview(
            detected_format=parsed.kind,
            headers=parsed.headers,
            mapping=mapping,
            rows=parsed.prebuilt,
        )
    mapping, rows = reprocess_rows(parsed, override=None, existing=set())
    return ImportPreview(detected_format=parsed.kind, headers=parsed.headers, mapping=mapping, rows=rows)


def reprocess_rows(
    parsed: ParsedFile,
    *,
    override: dict[str, str] | None,
    existing: set[str],
) -> tuple[dict[str, str], list[dict]]:
    source = parsed.records
    if parsed.prebuilt is not None and not source:
        source = [(row["row_number"], row["raw"]) for row in parsed.prebuilt]
    mapping = map_columns(parsed.headers, override)
    rows: list[dict] = []
    for row_number, raw in source:
        normalized, errors = normalize_values(raw, mapping)
        status, errors = validate_trade(normalized, errors)
        rows.append(
            {
                "row_number": row_number,
                "raw": raw,
                "normalized": normalized,
                "errors": errors,
                "status": status,
            }
        )
    mark_duplicates(rows, existing)
    _flag_unmatched_exits(rows)
    return mapping, rows


def _flag_unmatched_exits(rows: list[dict]) -> None:
    """A sell that only has an exit price closes an earlier buy of the same symbol."""
    open_buys: dict[str, Decimal] = {}
    for row in rows:
        if row.get("status") != "valid":
            continue
        normalized = row.get("normalized") or {}
        symbol = str(normalized.get("symbol") or "")
        quantity = _quantity(normalized.get("quantity"))
        if normalized.get("price") and normalized.get("side") == "buy" and not normalized.get("exit_price"):
            open_buys[symbol] = open_buys.get(symbol, Decimal("0")) + quantity
            continue
        if normalized.get("price") or normalized.get("side") != "sell" or not normalized.get("exit_price"):
            continue
        available = open_buys.get(symbol, Decimal("0"))
        if available <= 0:
            row["status"] = "attention"
            message = "No matching buy in this file"
            errors = [item for item in (row.get("errors") or []) if item != message]
            row["errors"] = errors + [message]
            continue
        open_buys[symbol] = available - min(available, quantity)


def _quantity(value: object) -> Decimal:
    try:
        return Decimal(str(value or "0"))
    except Exception:  # noqa: BLE001
        return Decimal("0")


def summarize(rows: list[dict]) -> tuple[int, int, int]:
    valid = sum(1 for row in rows if row["status"] == "valid")
    duplicates = sum(1 for row in rows if row["status"] == "duplicate")
    attention = sum(1 for row in rows if row["status"] == "attention")
    return valid, duplicates, attention
