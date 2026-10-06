"""Confirm a previewed import through the same execution → position → journal path."""

from __future__ import annotations

import uuid
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
    executions: list[CanonicalExecution] = []
    attention = 0
    for row in rows:
        if row.status != "valid":
            attention += 1
            continue
        data = row.normalized or {}
        try:
            when = datetime.fromisoformat(str(data.get("executed_at")).replace("Z", "+00:00"))
        except ValueError:
            row.status = "attention"
            row.errors = list(row.errors or []) + ["executed_at is not a timestamp"]
            attention += 1
            continue
        if when.tzinfo is None:
            when = when.replace(tzinfo=timezone.utc)
        external = str(data.get("external_id") or "")
        executions.append(
            CanonicalExecution(
                external_execution_id=external or f"row-{row.row_number}-open",
                external_position_id=external or None,
                provider_symbol=str(data.get("symbol") or ""),
                side=str(data.get("side") or "buy").lower(),
                quantity=D(data.get("quantity")),
                price=D(data.get("price")),
                commission=D(data.get("commission")),
                swap=D(data.get("swap")),
                executed_at=when,
                raw=row.raw or {},
            )
        )
        if data.get("exit_price"):
            closed = when
            if data.get("closed_at"):
                try:
                    closed = datetime.fromisoformat(str(data["closed_at"]).replace("Z", "+00:00"))
                    if closed.tzinfo is None:
                        closed = closed.replace(tzinfo=timezone.utc)
                except ValueError:
                    closed = when
            executions.append(
                CanonicalExecution(
                    external_execution_id=f"{external or row.row_number}:exit",
                    external_position_id=external or None,
                    provider_symbol=str(data.get("symbol") or ""),
                    side="sell" if str(data.get("side") or "buy").lower() == "buy" else "buy",
                    quantity=D(data.get("quantity")),
                    price=D(data.get("exit_price")),
                    executed_at=closed,
                    raw={"leg": "exit"},
                )
            )
    drafts = group_executions(executions, provider=batch.detected_format, account_key=str(batch.account_id))
    created = 0
    duplicates = 0
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
