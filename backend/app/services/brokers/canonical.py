"""Canonical order, execution, and position records. Money is Decimal."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal


def D(value: object, default: str = "0") -> Decimal:
    if value is None or value == "":
        return Decimal(default)
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def canonical_symbol(provider_symbol: str) -> str:
    text = (provider_symbol or "").strip().upper()
    if "." in text:
        head, _suffix = text.split(".", 1)
        if head.isalpha() and len(head) >= 6:
            return head
    return text.replace("-", "").replace("_", "").replace("/", "")


def as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def fingerprint(
    *,
    provider: str,
    account_id: str,
    provider_symbol: str,
    side: str,
    quantity: Decimal,
    price: Decimal,
    executed_at: datetime,
) -> str:
    stamp = as_utc(executed_at).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
    raw = "|".join(
        [
            provider,
            account_id,
            provider_symbol,
            side,
            format(quantity, "f"),
            format(price, "f"),
            stamp,
        ]
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


@dataclass
class CanonicalExecution:
    external_execution_id: str
    provider_symbol: str
    side: str
    quantity: Decimal
    price: Decimal
    executed_at: datetime
    external_order_id: str | None = None
    external_position_id: str | None = None
    commission: Decimal = field(default_factory=lambda: Decimal("0"))
    swap: Decimal = field(default_factory=lambda: Decimal("0"))
    funding: Decimal = field(default_factory=lambda: Decimal("0"))
    currency: str = "USD"
    position_side: str | None = None
    fees: Decimal = field(default_factory=lambda: Decimal("0"))
    asset_class: str | None = None
    instrument_type: str | None = None
    stop_loss: Decimal | None = None
    take_profit: Decimal | None = None
    leverage: Decimal | None = None
    contract_size: Decimal | None = None
    source: str = "api"
    identity_rank: int = 1
    raw: dict = field(default_factory=dict)

    @property
    def symbol(self) -> str:
        return canonical_symbol(self.provider_symbol)


@dataclass
class CanonicalOrder:
    external_order_id: str
    provider_symbol: str
    side: str
    status: str
    quantity: Decimal
    price: Decimal | None = None
    asset_class: str | None = None
    instrument_type: str | None = None
    raw: dict = field(default_factory=dict)

    @property
    def symbol(self) -> str:
        return canonical_symbol(self.provider_symbol)


@dataclass
class CanonicalPosition:
    external_position_id: str
    provider_symbol: str
    side: str
    quantity: Decimal
    status: str = "open"
    entry_price: Decimal | None = None
    unrealized_pnl: Decimal | None = None
    asset_class: str | None = None
    instrument_type: str | None = None
    raw: dict = field(default_factory=dict)

    @property
    def symbol(self) -> str:
        return canonical_symbol(self.provider_symbol)


@dataclass
class CanonicalAccount:
    external_account_id: str
    currency: str
    balance: Decimal | None = None
    equity: Decimal | None = None
    account_type: str | None = None
    leverage: Decimal | None = None
    permissions: dict[str, bool] = field(default_factory=dict)
    raw: dict = field(default_factory=dict)
