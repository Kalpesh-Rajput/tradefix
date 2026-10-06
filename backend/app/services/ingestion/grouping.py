"""Build positions from executions. Spot without a position id uses FIFO."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal

from app.services.brokers.canonical import CanonicalExecution, D, canonical_symbol


@dataclass
class PositionDraft:
    external_position_id: str
    provider_symbol: str
    canonical: str
    side: str
    quantity: Decimal
    entry_price: Decimal
    exit_price: Decimal | None
    opened_at: datetime
    closed_at: datetime | None
    commission: Decimal
    swap: Decimal
    funding: Decimal
    gross_pnl: Decimal | None
    net_pnl: Decimal | None
    currency: str
    executions: list[CanonicalExecution] = field(default_factory=list)
    status: str = "open"


def group_executions(rows: list[CanonicalExecution], *, provider: str, account_key: str) -> list[PositionDraft]:
    positioned = [row for row in rows if row.external_position_id]
    loose = [row for row in rows if not row.external_position_id]
    drafts = [_from_position_id(group) for group in _buckets(positioned).values()]
    drafts.extend(_fifo(loose, provider=provider, account_key=account_key))
    return drafts


def _buckets(rows: list[CanonicalExecution]) -> dict[str, list[CanonicalExecution]]:
    grouped: dict[str, list[CanonicalExecution]] = {}
    for row in rows:
        grouped.setdefault(str(row.external_position_id), []).append(row)
    return grouped


def _from_position_id(rows: list[CanonicalExecution]) -> PositionDraft:
    ordered = sorted(rows, key=lambda row: row.executed_at)
    first = ordered[0]
    opens = [row for row in ordered if _is_open_leg(row, ordered)]
    closes = [row for row in ordered if row not in opens]
    if not opens:
        opens = ordered[:1]
        closes = ordered[1:]
    entry = _weighted(opens)
    exit_price = _weighted(closes) if closes else None
    qty = sum((row.quantity for row in opens), Decimal("0"))
    side = "long" if opens[0].side == "buy" else "short"
    gross = _pnl(side, entry, exit_price, min(qty, sum((row.quantity for row in closes), Decimal("0")))) if exit_price is not None else None
    authoritative = _authoritative_pnl(ordered)
    commission = sum((row.commission for row in ordered), Decimal("0"))
    swap = sum((row.swap for row in ordered), Decimal("0"))
    funding = sum((row.funding for row in ordered), Decimal("0"))
    net = authoritative if authoritative is not None else (None if gross is None else gross - commission - swap - funding)
    return PositionDraft(
        external_position_id=str(first.external_position_id),
        provider_symbol=first.provider_symbol,
        canonical=canonical_symbol(first.provider_symbol),
        side=side,
        quantity=qty,
        entry_price=entry,
        exit_price=exit_price,
        opened_at=ordered[0].executed_at,
        closed_at=ordered[-1].executed_at if closes else None,
        commission=commission,
        swap=swap,
        funding=funding,
        gross_pnl=gross,
        net_pnl=net,
        currency=first.currency,
        executions=ordered,
        status="closed" if closes else "open",
    )


def _fifo(rows: list[CanonicalExecution], *, provider: str, account_key: str) -> list[PositionDraft]:
    by_symbol: dict[str, list[CanonicalExecution]] = {}
    for row in rows:
        by_symbol.setdefault(row.provider_symbol, []).append(row)
    drafts: list[PositionDraft] = []
    for symbol, group in by_symbol.items():
        ordered = sorted(group, key=lambda row: row.executed_at)
        inventory: list[list] = []
        sequence = 0
        for row in ordered:
            qty = row.quantity
            if row.side == "buy":
                inventory.append([row, qty])
                continue
            while qty > 0 and inventory:
                lot, left = inventory[0]
                matched = min(left, qty)
                sequence += 1
                drafts.append(_pair(symbol, lot, row, matched, sequence, provider, account_key))
                left -= matched
                qty -= matched
                if left <= 0:
                    inventory.pop(0)
                else:
                    inventory[0][1] = left
        for lot, left in inventory:
            if left <= 0:
                continue
            drafts.append(
                PositionDraft(
                    external_position_id=f"open:{provider}:{account_key}:{symbol}:{lot.external_execution_id}",
                    provider_symbol=symbol,
                    canonical=canonical_symbol(symbol),
                    side="long",
                    quantity=left,
                    entry_price=lot.price,
                    exit_price=None,
                    opened_at=lot.executed_at,
                    closed_at=None,
                    commission=lot.commission,
                    swap=lot.swap,
                    funding=lot.funding,
                    gross_pnl=None,
                    net_pnl=None,
                    currency=lot.currency,
                    executions=[lot],
                    status="open",
                )
            )
    return drafts


def _pair(symbol, entry_row, exit_row, qty, sequence, provider, account_key) -> PositionDraft:
    identity = f"fifo:{provider}:{account_key}:{symbol}:{entry_row.external_execution_id}:{sequence}"
    gross = (exit_row.price - entry_row.price) * qty
    commission = entry_row.commission + exit_row.commission
    return PositionDraft(
        external_position_id=identity,
        provider_symbol=symbol,
        canonical=canonical_symbol(symbol),
        side="long",
        quantity=qty,
        entry_price=entry_row.price,
        exit_price=exit_row.price,
        opened_at=entry_row.executed_at,
        closed_at=exit_row.executed_at,
        commission=commission,
        swap=entry_row.swap + exit_row.swap,
        funding=entry_row.funding + exit_row.funding,
        gross_pnl=gross,
        net_pnl=gross - commission,
        currency=entry_row.currency,
        executions=[entry_row, exit_row],
        status="closed",
    )


def _is_open_leg(row: CanonicalExecution, ordered: list[CanonicalExecution]) -> bool:
    first_side = ordered[0].side
    return row.side == first_side


def _weighted(rows: list[CanonicalExecution]) -> Decimal:
    total_qty = sum((row.quantity for row in rows), Decimal("0"))
    if total_qty == 0:
        return Decimal("0")
    return sum((row.price * row.quantity for row in rows), Decimal("0")) / total_qty


def _pnl(side: str, entry: Decimal, exit_price: Decimal | None, qty: Decimal) -> Decimal | None:
    if exit_price is None:
        return None
    if side == "long":
        return (exit_price - entry) * qty
    return (entry - exit_price) * qty


def _authoritative_pnl(rows: list[CanonicalExecution]) -> Decimal | None:
    for row in rows:
        raw = row.raw or {}
        if raw.get("netPL") is not None:
            return D(raw.get("netPL"))
        if raw.get("closedPnl") is not None:
            return D(raw.get("closedPnl"))
    return None
