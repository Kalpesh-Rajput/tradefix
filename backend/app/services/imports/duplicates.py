"""Flag rows that repeat inside the file or already exist on the account."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.trade import Trade
from app.services.brokers.canonical import D


def mark_duplicates(rows: list[dict], existing: set[str]) -> None:
    seen_ext: dict[str, int] = {}
    seen_loose: dict[str, int] = {}
    for row in rows:
        if row.get("status") != "valid":
            continue
        normalized = row.get("normalized") or {}
        ext = _ext_key(normalized)
        loose = _loose_key(normalized)
        earlier = None
        if ext and ext in seen_ext:
            earlier = seen_ext[ext]
        elif loose and loose in seen_loose:
            earlier = seen_loose[loose]
        if earlier is not None:
            _flag(row, f"Duplicate of row {earlier} in this file")
            continue
        if (ext and ext in existing) or (loose and loose in existing):
            _flag(row, "Already in this account")
            continue
        if ext:
            seen_ext[ext] = row["row_number"]
        if loose:
            seen_loose[loose] = row["row_number"]


def existing_duplicate_keys(db: Session, user_id: uuid.UUID, account_id: uuid.UUID) -> set[str]:
    trades = db.execute(
        select(
            Trade.external_trade_id,
            Trade.symbol,
            Trade.side,
            Trade.quantity,
            Trade.entry_price,
            Trade.opened_at,
        ).where(Trade.user_id == user_id, Trade.account_id == account_id)
    ).all()
    keys: set[str] = set()
    for trade in trades:
        if trade.external_trade_id:
            keys.add(f"ext:{str(trade.external_trade_id).strip()}")
        loose = _loose_from_trade(trade)
        if loose:
            keys.add(loose)
    return keys


def _flag(row: dict, message: str) -> None:
    row["status"] = "duplicate"
    errors = [item for item in (row.get("errors") or []) if item != message]
    row["errors"] = errors + [message]


def _ext_key(normalized: dict) -> str | None:
    external = str(normalized.get("external_id") or "").strip()
    return f"ext:{external}" if external else None


def _loose_key(normalized: dict) -> str | None:
    symbol = normalized.get("symbol")
    side = normalized.get("side")
    quantity = normalized.get("quantity")
    price = normalized.get("price") or normalized.get("exit_price")
    executed = normalized.get("executed_at") or normalized.get("closed_at")
    if not (symbol and side and quantity and price and executed):
        return None
    try:
        when = datetime.fromisoformat(str(executed).replace("Z", "+00:00"))
    except ValueError:
        return None
    return _compose(str(symbol), str(side), when, quantity, price)


def _loose_from_trade(trade) -> str | None:
    if not trade.symbol or trade.opened_at is None or trade.entry_price is None or trade.quantity is None:
        return None
    side_value = trade.side.value if hasattr(trade.side, "value") else str(trade.side)
    side = "buy" if side_value in {"long", "buy"} else "sell"
    return _compose(str(trade.symbol), side, trade.opened_at, trade.quantity, trade.entry_price)


def _compose(symbol: str, side: str, when: datetime, quantity, price) -> str:
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    else:
        when = when.astimezone(timezone.utc)
    stamp = when.strftime("%Y-%m-%dT%H:%M")
    return f"{symbol.strip().upper()}|{side}|{stamp}|{_plain(quantity)}|{_plain(price)}"


def _plain(value) -> str:
    text = format(D(value), "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text or "0"
