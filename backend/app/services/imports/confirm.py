"""Confirm a previewed import through the same execution → position → journal path."""

from __future__ import annotations

import re
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.broker import ImportBatch, ImportRow
from app.models.trade import AssetType, Trade, TradeSide, TradeStatus
from app.models.user import User
from app.services.brokers.canonical import CanonicalExecution, D, fingerprint
from app.services.ingestion.grouping import group_executions

_ASSET = {
    "zerodha-tradebook-csv": AssetType.stock,
    "mt4-html": AssetType.forex,
    "mt5-html": AssetType.forex,
}


def confirm_batch(db: Session, user: User, batch: ImportBatch) -> dict[str, int]:
    rows = db.scalars(
        select(ImportRow).where(ImportRow.batch_id == batch.id, ImportRow.user_id == user.id).order_by(ImportRow.row_number)
    ).all()
    planned: list[tuple[ImportRow, list[CanonicalExecution]]] = []
    executions: list[CanonicalExecution] = []
    attention = 0
    duplicates = 0
    for row in rows:
        if row.status == "duplicate":
            duplicates += 1
            continue
        if row.status != "valid":
            attention += 1
            continue
        built, error = executions_for_row(row)
        if error:
            row.status = "attention"
            row.errors = list(row.errors or []) + [error]
            attention += 1
            continue
        planned.append((row, built))
        executions.extend(built)
    drafts = group_executions(executions, provider=batch.detected_format, account_key=str(batch.account_id))
    used = {execution.external_execution_id for draft in drafts for execution in draft.executions}
    for row, built in planned:
        if built and any(execution.external_execution_id in used for execution in built):
            continue
        row.status = "attention"
        row.errors = list(row.errors or []) + ["No matching buy in this file"]
        attention += 1
    created = 0
    asset = _ASSET.get(batch.detected_format, AssetType.stock)
    journal_by_fill = {
        execution.external_execution_id: (row.normalized or {})
        for row, built in planned
        for execution in built
    }
    for draft in drafts:
        external_id = draft.external_position_id or fingerprint(
            provider=batch.detected_format,
            account_id=str(batch.account_id),
            provider_symbol=draft.provider_symbol,
            side=draft.side,
            quantity=draft.quantity,
            price=draft.entry_price,
            executed_at=draft.opened_at,
        )
        existing = db.scalar(
            select(Trade).where(
                Trade.user_id == user.id,
                Trade.account_id == batch.account_id,
                Trade.external_trade_id == external_id,
            )
        )
        if existing is not None:
            duplicates += 1
            continue
        trade = Trade(
            user_id=user.id,
            account_id=batch.account_id,
            symbol=draft.canonical[:32] or draft.provider_symbol[:32],
            asset_type=asset,
            side=TradeSide.long if draft.side == "long" else TradeSide.short,
            quantity=draft.quantity,
            entry_price=draft.entry_price,
            exit_price=draft.exit_price,
            opened_at=draft.opened_at,
            closed_at=draft.closed_at,
            pnl=draft.net_pnl,
            fees=draft.commission + draft.swap + draft.funding,
            status=TradeStatus.closed if draft.status == "closed" else TradeStatus.open,
            source=f"file:{batch.detected_format}",
            external_trade_id=external_id,
            provider_symbol=draft.provider_symbol,
            canonical_symbol=draft.canonical,
            commission=draft.commission,
            swap=draft.swap,
            funding=draft.funding,
            gross_pnl=draft.gross_pnl,
        )
        sources = []
        for execution in draft.executions:
            data = journal_by_fill.get(execution.external_execution_id)
            if data and data not in sources:
                sources.append(data)
        apply_journal(trade, sources)
        db.add(trade)
        created += 1
    batch.status = "imported"
    batch.duplicate_count = duplicates
    batch.attention_count = attention
    db.commit()
    return {"created": created, "duplicates": duplicates, "attention": attention, "detected": len(rows)}


def executions_for_row(row: ImportRow) -> tuple[list[CanonicalExecution], str | None]:
    """Turn one preview row into one fill, or an entry plus its exit."""
    data = row.normalized or {}
    side = str(data.get("side") or "buy").lower()
    external = str(data.get("external_id") or "")
    symbol = str(data.get("symbol") or "")
    quantity = D(data.get("quantity"))
    opened = _parse_time(data.get("executed_at"))
    closed = _parse_time(data.get("closed_at"))
    if data.get("price"):
        if opened is None:
            return [], "open time is missing"
        position_id = external or (f"row-{row.row_number}" if data.get("exit_price") else None)
        fills = [
            CanonicalExecution(
                external_execution_id=external or f"row-{row.row_number}-open",
                external_position_id=position_id,
                provider_symbol=symbol,
                side=side,
                quantity=quantity,
                price=D(data.get("price")),
                commission=D(data.get("commission")),
                swap=D(data.get("swap")),
                executed_at=opened,
                raw=row.raw or {},
            )
        ]
        if data.get("exit_price"):
            fills.append(
                CanonicalExecution(
                    external_execution_id=f"{external or row.row_number}:exit",
                    external_position_id=position_id,
                    provider_symbol=symbol,
                    side="sell" if side == "buy" else "buy",
                    quantity=quantity,
                    price=D(data.get("exit_price")),
                    executed_at=closed or opened,
                    raw={"leg": "exit"},
                )
            )
        return fills, None
    if data.get("exit_price"):
        if closed is None:
            return [], "close time is missing"
        return [
            CanonicalExecution(
                external_execution_id=external or f"row-{row.row_number}-exit",
                external_position_id=external or None,
                provider_symbol=symbol,
                side=side,
                quantity=quantity,
                price=D(data.get("exit_price")),
                commission=D(data.get("commission")),
                swap=D(data.get("swap")),
                executed_at=closed,
                raw=row.raw or {},
            )
        ], None
    return [], "exit price is missing" if side == "sell" else "entry price is missing"


_ASSETS = {
    "stock": AssetType.stock,
    "stocks": AssetType.stock,
    "equity": AssetType.stock,
    "option": AssetType.option,
    "options": AssetType.option,
    "future": AssetType.future,
    "futures": AssetType.future,
    "forex": AssetType.forex,
    "fx": AssetType.forex,
    "crypto": AssetType.crypto,
    "cryptocurrency": AssetType.crypto,
}


def apply_journal(trade: Trade, sources: list[dict]) -> None:
    """Copy notes, emotions, and the other journal columns onto the saved trade."""
    notes = _first(sources, "notes")
    if notes:
        trade.notes = notes
    emotions = _tags(sources, "emotions")
    if emotions:
        trade.emotion_tags = emotions
    mood = _clip(_first(sources, "mood"), 2000)
    if mood:
        trade.mood = mood
    strategy = _clip(_first(sources, "strategy"), 120)
    if strategy:
        trade.strategy_name = strategy
    setups = _tags(sources, "setup")
    if setups:
        trade.setup_tag = setups[0][:100]
        trade.setup_tags = setups
    rules = _tags(sources, "rules_broken")
    if rules:
        trade.rules_broken = rules
    session = _clip(_first(sources, "session"), 64)
    if session:
        trade.session = session
    trade_type = _clip(_first(sources, "trade_type"), 64)
    if trade_type:
        trade.trade_type = trade_type
    entry_condition = _clip(_first(sources, "entry_condition"), 120)
    if entry_condition:
        trade.entry_condition = entry_condition
    exit_condition = _clip(_first(sources, "exit_condition"), 120)
    if exit_condition:
        trade.exit_condition = exit_condition
    option_type = _clip(_first(sources, "option_type"), 16)
    if option_type:
        trade.option_type = option_type
    analysis = _clip(_first(sources, "analysis_timeframe"), 32)
    if analysis:
        trade.analysis_timeframe = analysis
    entry_timeframe = _clip(_first(sources, "entry_timeframe"), 32)
    if entry_timeframe:
        trade.entry_timeframe = entry_timeframe
    asset = _ASSETS.get((_first(sources, "asset_type") or "").strip().lower())
    if asset is not None:
        trade.asset_type = asset
    _set_money(trade, "stop_loss", _first(sources, "stop_loss"))
    _set_money(trade, "profit_target", _first(sources, "profit_target"))
    _set_money(trade, "risk_amount", _first(sources, "risk_amount"))
    _set_money(trade, "strike_price", _first(sources, "strike_price"))
    _set_money(trade, "pnl", _first(sources, "pnl"))
    _set_money(trade, "gross_pnl", _first(sources, "gross_pnl"))
    if _set_money(trade, "funding", _first(sources, "funding")):
        trade.fees = _total(trade.commission, trade.swap, trade.funding)
    leverage = _leverage(_first(sources, "leverage"))
    if leverage is not None:
        trade.leverage = leverage
    rating = _whole(_first(sources, "rating"), 1, 10)
    if rating is not None:
        trade.rating = rating
    expiry = _date(_first(sources, "expiry_date"))
    if expiry is not None:
        trade.expiry_date = expiry


def _first(sources: list[dict], field: str) -> str | None:
    for source in sources:
        value = source.get(field)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return None


def _clip(value: str | None, limit: int) -> str | None:
    if not value:
        return None
    text = value.strip()
    return text[:limit] or None


def _tags(sources: list[dict], field: str) -> list[str]:
    found: list[str] = []
    for source in sources:
        raw = source.get(field)
        if not raw:
            continue
        for part in re.split(r"[,;|]", str(raw)):
            text = part.strip()[:80]
            if text and text not in found:
                found.append(text)
            if len(found) >= 12:
                return found
    return found


def _money(value: str | None) -> Decimal | None:
    if not value:
        return None
    try:
        return Decimal(str(value))
    except InvalidOperation:
        return None


def _set_money(trade: Trade, field: str, value: str | None) -> bool:
    number = _money(value)
    if number is None:
        return False
    setattr(trade, field, number)
    return True


def _total(*parts: object) -> Decimal:
    total = Decimal("0")
    for part in parts:
        if part is None:
            continue
        try:
            total += Decimal(str(part))
        except InvalidOperation:
            continue
    return total


def _leverage(value: str | None) -> Decimal | None:
    if not value:
        return None
    text = value.strip().lower().replace(" ", "")
    if ":" in text:
        text = text.split(":")[-1]
    try:
        number = Decimal(text)
    except InvalidOperation:
        return None
    if number <= 0:
        return None
    return number


def _whole(value: str | None, low: int, high: int) -> int | None:
    number = _money(value)
    if number is None or number != int(number):
        return None
    whole = int(number)
    if whole < low or whole > high:
        return None
    return whole


def _date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def _parse_time(value: object) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed
