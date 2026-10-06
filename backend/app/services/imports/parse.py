"""File detection and row parsing. A format is detected only from headers or markup we test."""

from __future__ import annotations

import io
import re
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

import pandas as pd

from app.services.brokers.canonical import D

_ALIASES = {
    "symbol": ("symbol", "ticker", "instrument", "product_symbol"),
    "side": ("side", "direction", "type", "trade_type", "buy/sell"),
    "quantity": ("quantity", "qty", "volume", "size", "lots"),
    "price": ("price", "entry_price", "open_price", "price_open", "buy_price", "fill price"),
    "executed_at": ("executed_at", "open_time", "time", "date", "trade_date", "entry_time"),
    "commission": ("commission", "fees", "fee"),
}


def parse_upload(filename: str, payload: bytes) -> tuple[str, list[dict]]:
    name = filename.lower()
    text = payload.decode("utf-8", errors="replace")
    if "<html" in text.lower() and "closed transactions" in text.lower():
        kind = "mt4-html" if "mt4" in text.lower() or "metatrader 4" in text.lower() else "mt5-html"
        return kind, _parse_mt_html(text)
    if name.endswith(".xlsx"):
        frame = pd.read_excel(io.BytesIO(payload))
        return _frame_kind(frame), _frame_rows(frame)
    frame = pd.read_csv(io.BytesIO(payload))
    return _frame_kind(frame), _frame_rows(frame)


def _frame_kind(frame: pd.DataFrame) -> str:
    headers = {str(col).strip().lower() for col in frame.columns}
    if {"symbol", "trade_date", "trade_type", "quantity", "price"}.issubset(headers):
        return "zerodha-tradebook-csv"
    return "csv"


def _frame_rows(frame: pd.DataFrame) -> list[dict]:
    columns = [str(col) for col in frame.columns]
    mapping = {field: _match(columns, aliases) for field, aliases in _ALIASES.items()}
    rows: list[dict] = []
    for index, record in frame.iterrows():
        raw = {str(key): _cell(record[key]) for key in frame.columns}
        normalized, errors = _normalize(raw, mapping)
        rows.append(
            {
                "row_number": int(index) + 2,
                "raw": raw,
                "normalized": normalized,
                "errors": errors,
                "status": "attention" if errors else "valid",
            }
        )
    return rows


def _parse_mt_html(text: str) -> list[dict]:
    rows: list[dict] = []
    # MetaQuotes statements put one trade in a <tr> of <td> cells after the Closed Transactions header.
    body = text
    marker = re.search(r"closed transactions", text, flags=re.IGNORECASE)
    if marker:
        body = text[marker.start() :]
    for index, match in enumerate(re.findall(r"<tr[^>]*>(.*?)</tr>", body, flags=re.IGNORECASE | re.DOTALL)):
        cells = [re.sub(r"<[^>]+>", "", cell).strip() for cell in re.findall(r"<td[^>]*>(.*?)</td>", match, flags=re.IGNORECASE | re.DOTALL)]
        if len(cells) < 8:
            continue
        if not cells[0].isdigit():
            continue
        # Typical order: ticket, open time, type, size, item, price, sl, tp, close time, price, commission, taxes, swap, profit
        raw = {
            "ticket": cells[0],
            "open_time": cells[1],
            "type": cells[2],
            "size": cells[3],
            "item": cells[4],
            "open_price": cells[5],
            "close_time": cells[8] if len(cells) > 8 else "",
            "close_price": cells[9] if len(cells) > 9 else "",
            "commission": cells[10] if len(cells) > 10 else "",
            "swap": cells[12] if len(cells) > 12 else "",
        }
        errors: list[str] = []
        try:
            opened = _parse_dt(raw["open_time"])
        except ValueError:
            opened = None
            errors.append("open time was not understood")
        side = raw["type"].lower()
        if side not in {"buy", "sell"}:
            continue
        normalized = {
            "symbol": raw["item"],
            "side": side,
            "quantity": raw["size"],
            "price": raw["open_price"],
            "exit_price": raw["close_price"],
            "executed_at": opened.isoformat() if opened else None,
            "closed_at": raw["close_time"],
            "commission": raw["commission"],
            "swap": raw["swap"],
            "external_id": raw["ticket"],
        }
        rows.append(
            {
                "row_number": index + 1,
                "raw": raw,
                "normalized": normalized,
                "errors": errors,
                "status": "attention" if errors else "valid",
            }
        )
    return rows


def _normalize(raw: dict, mapping: dict[str, str | None]) -> tuple[dict, list[str]]:
    errors: list[str] = []
    normalized: dict[str, str | None] = {}
    for field, column in mapping.items():
        normalized[field] = raw.get(column) if column else None
        if field in {"symbol", "quantity", "price", "executed_at"} and not normalized[field]:
            errors.append(f"{field} is missing")
    return normalized, errors


def _match(columns: list[str], aliases: tuple[str, ...]) -> str | None:
    lookup = {column.lower().strip(): column for column in columns}
    for alias in aliases:
        if alias in lookup:
            return lookup[alias]
    return None


def _cell(value: object) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ""
    return str(value).strip()


def _parse_dt(value: str) -> datetime:
    text = value.strip()
    for fmt in ("%Y.%m.%d %H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    raise ValueError(text)


def decimal_or_none(value: object) -> Decimal | None:
    try:
        return D(value)
    except (InvalidOperation, ValueError):
        return None
