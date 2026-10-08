"""Confirm a previewed import through the same execution → position → journal path."""

from __future__ import annotations

from datetime import datetime, timezone

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
        db.add(
            Trade(
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
        )
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
