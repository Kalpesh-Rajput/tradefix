"""Shared ingest: raw record, execution, position, journal trade. Database is the dedup source."""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.broker import BrokerExecution, BrokerPosition, RawProviderRecord
from app.models.trade import AssetType, ExecutionLegType, Trade, TradeExecution, TradeSide, TradeStatus
from app.services.brokers.canonical import CanonicalExecution, fingerprint
from app.services.ingestion.grouping import PositionDraft, group_executions

_ASSET = {
    "mt5": AssetType.forex,
    "mt4": AssetType.forex,
    "xm": AssetType.forex,
    "exness": AssetType.forex,
    "avatrade": AssetType.forex,
    "ctrader": AssetType.forex,
    "xtb": AssetType.forex,
    "zerodha": AssetType.stock,
}


def persist_executions(
    db: Session,
    *,
    user_id: uuid.UUID,
    broker_account_id: uuid.UUID,
    journal_account_id: uuid.UUID,
    provider: str,
    rows: list[CanonicalExecution],
    sync_run_id: uuid.UUID | None,
) -> dict[str, int]:
    counts = {"received": len(rows), "created": 0, "updated": 0, "skipped": 0, "failed": 0}
    if not rows:
        return counts
    for row in rows:
        try:
            with db.begin_nested():
                created = _upsert_execution(db, user_id, broker_account_id, provider, row, sync_run_id)
            counts["created" if created else "updated"] += 1
        except Exception:
            counts["failed"] += 1
    drafts = group_executions(rows, provider=provider, account_key=str(broker_account_id))
    for draft in drafts:
        _upsert_position(db, user_id, broker_account_id, draft)
        _upsert_journal(db, user_id, broker_account_id, journal_account_id, provider, draft)
    db.commit()
    return counts


def _upsert_execution(db, user_id, broker_account_id, provider, row: CanonicalExecution, sync_run_id) -> bool:
    digest = hashlib.sha256(json.dumps(row.raw, sort_keys=True, default=str).encode()).hexdigest()
    external_id = row.external_execution_id or fingerprint(
        provider=provider,
        account_id=str(broker_account_id),
        provider_symbol=row.provider_symbol,
        side=row.side,
        quantity=row.quantity,
        price=row.price,
        executed_at=row.executed_at,
    )
    rank = 1 if row.external_execution_id else 4
    raw_id = uuid.uuid4()
    db.execute(
        insert(RawProviderRecord)
        .values(
            id=raw_id,
            user_id=user_id,
            broker_account_id=broker_account_id,
            sync_run_id=sync_run_id,
            record_type="execution",
            external_id=external_id,
            payload_hash=digest,
            payload=row.raw or {"normalized": True},
        )
        .on_conflict_do_nothing(constraint="uq_raw_provider_record")
    )
    existing = db.scalar(
        select(BrokerExecution).where(
            BrokerExecution.broker_account_id == broker_account_id,
            BrokerExecution.external_execution_id == external_id,
        )
    )
    fp = fingerprint(
        provider=provider,
        account_id=str(broker_account_id),
        provider_symbol=row.provider_symbol,
        side=row.side,
        quantity=row.quantity,
        price=row.price,
        executed_at=row.executed_at,
    )
    if existing is None:
        db.add(
            BrokerExecution(
                user_id=user_id,
                broker_account_id=broker_account_id,
                external_execution_id=external_id,
                external_order_id=row.external_order_id,
                external_position_id=row.external_position_id,
                provider_symbol=row.provider_symbol,
                canonical_symbol=row.symbol,
                side=row.side or "buy",
                quantity=row.quantity,
                price=row.price,
                commission=row.commission,
                swap=row.swap,
                funding=row.funding,
                currency=row.currency,
                executed_at=row.executed_at,
                identity_rank=rank,
                fingerprint=fp,
            )
        )
        db.flush()
        return True
    existing.quantity = row.quantity
    existing.price = row.price
    existing.commission = row.commission
    existing.swap = row.swap
    existing.funding = row.funding
    db.flush()
    return False


def _upsert_position(db, user_id, broker_account_id, draft: PositionDraft) -> None:
    existing = db.scalar(
        select(BrokerPosition).where(
            BrokerPosition.broker_account_id == broker_account_id,
            BrokerPosition.external_position_id == draft.external_position_id,
        )
    )
    if existing is None:
        db.add(
            BrokerPosition(
                user_id=user_id,
                broker_account_id=broker_account_id,
                external_position_id=draft.external_position_id,
                provider_symbol=draft.provider_symbol,
                canonical_symbol=draft.canonical,
                side=draft.side,
                status=draft.status,
                quantity=draft.quantity,
                entry_price=draft.entry_price,
                exit_price=draft.exit_price,
                gross_pnl=draft.gross_pnl,
                net_pnl=draft.net_pnl,
                commission=draft.commission,
                swap=draft.swap,
                funding=draft.funding,
                currency=draft.currency,
                opened_at=draft.opened_at,
                closed_at=draft.closed_at,
            )
        )
    else:
        existing.status = draft.status
        existing.exit_price = draft.exit_price
        existing.gross_pnl = draft.gross_pnl
        existing.net_pnl = draft.net_pnl
        existing.closed_at = draft.closed_at
    db.flush()


def _upsert_journal(db, user_id, broker_account_id, journal_account_id, provider, draft: PositionDraft) -> None:
    existing = db.scalar(
        select(Trade).where(
            Trade.user_id == user_id,
            Trade.broker_account_id == broker_account_id,
            Trade.external_trade_id == draft.external_position_id,
        )
    )
    side = TradeSide.long if draft.side == "long" else TradeSide.short
    status = TradeStatus.closed if draft.status == "closed" else TradeStatus.open
    asset = _ASSET.get(provider, AssetType.crypto)
    if existing is None:
        trade = Trade(
            user_id=user_id,
            account_id=journal_account_id,
            symbol=draft.canonical[:32],
            asset_type=asset,
            side=side,
            quantity=draft.quantity,
            entry_price=draft.entry_price,
            exit_price=draft.exit_price,
            opened_at=draft.opened_at,
            closed_at=draft.closed_at,
            pnl=draft.net_pnl,
            fees=draft.commission + draft.swap + draft.funding,
            status=status,
            source=f"api:{provider}",
            broker_account_id=broker_account_id,
            external_trade_id=draft.external_position_id,
            provider_symbol=draft.provider_symbol,
            canonical_symbol=draft.canonical,
            commission=draft.commission,
            swap=draft.swap,
            funding=draft.funding,
            gross_pnl=draft.gross_pnl,
            is_sync=True,
        )
        db.add(trade)
        db.flush()
        _replace_legs(db, trade, draft)
        return
    existing.exit_price = draft.exit_price
    existing.closed_at = draft.closed_at
    existing.pnl = draft.net_pnl
    existing.fees = draft.commission + draft.swap + draft.funding
    existing.status = status
    existing.commission = draft.commission
    existing.swap = draft.swap
    existing.funding = draft.funding
    existing.gross_pnl = draft.gross_pnl
    existing.is_sync = True
    _replace_legs(db, existing, draft)
    db.flush()


def _replace_legs(db, trade: Trade, draft: PositionDraft) -> None:
    for leg in list(trade.executions):
        db.delete(leg)
    db.flush()
    for index, row in enumerate(draft.executions):
        leg_type = ExecutionLegType.entry if index == 0 or row.side == ("buy" if draft.side == "long" else "sell") else ExecutionLegType.exit
        if draft.status == "closed" and row.executed_at == draft.closed_at and index > 0:
            leg_type = ExecutionLegType.exit
        db.add(
            TradeExecution(
                trade_id=trade.id,
                leg_type=leg_type if index == 0 else (ExecutionLegType.exit if row.executed_at != draft.opened_at else ExecutionLegType.entry),
                quantity=row.quantity,
                price=row.price,
                executed_at=row.executed_at,
                fees=row.commission,
                external_execution_id=row.external_execution_id,
                sort_order=index,
            )
        )
