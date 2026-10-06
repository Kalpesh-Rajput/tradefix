"""Connector contract. Unsupported calls raise NotSupportedError. Never return fake rows."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Callable

from app.services.brokers.canonical import CanonicalAccount, CanonicalExecution, CanonicalOrder, CanonicalPosition
from app.services.brokers.errors import NotSupportedError


def not_supported(action: str) -> NotSupportedError:
    return NotSupportedError(f"{action} is not supported for this provider.")


class BaseBrokerConnector:
    """Read-only provider adapter. Subclasses override only the methods they implement."""

    provider_id: str = ""

    def validate_credentials(self, credentials: dict) -> CanonicalAccount:
        return self.validate(credentials)

    def validate(self, credentials: dict) -> CanonicalAccount:
        raise not_supported("validate_credentials")

    def get_account_info(self, credentials: dict) -> CanonicalAccount:
        return self.validate_credentials(credentials)

    def get_accounts(self, credentials: dict) -> list[CanonicalAccount]:
        return self.list_accounts(credentials)

    def list_accounts(self, credentials: dict) -> list[CanonicalAccount]:
        raise not_supported("get_accounts")

    def get_balance(self, credentials: dict) -> Decimal | None:
        return self.get_account_info(credentials).balance

    def get_open_positions(self, credentials: dict) -> list[CanonicalPosition]:
        raise not_supported("get_open_positions")

    def get_open_orders(self, credentials: dict) -> list[CanonicalOrder]:
        raise not_supported("get_open_orders")

    def get_order_history(self, credentials: dict, start: datetime, end: datetime) -> list[CanonicalOrder]:
        raise not_supported("get_order_history")

    def get_fills(
        self,
        credentials: dict,
        start: datetime,
        end: datetime,
        on_batch: Callable[[list[CanonicalExecution], dict], None],
        resume: dict | None = None,
    ) -> None:
        self.fetch_executions(credentials, start, end, on_batch, resume)

    def get_trade_history(
        self,
        credentials: dict,
        start: datetime,
        end: datetime,
        on_batch: Callable[[list[CanonicalExecution], dict], None],
        resume: dict | None = None,
    ) -> None:
        self.get_fills(credentials, start, end, on_batch, resume)

    def fetch_executions(
        self,
        credentials: dict,
        start: datetime,
        end: datetime,
        on_batch: Callable[[list[CanonicalExecution], dict], None],
        resume: dict | None = None,
    ) -> None:
        raise not_supported("get_fills")

    def health_check(self, credentials: dict) -> CanonicalAccount:
        return self.validate_credentials(credentials)

    def refresh_credentials(self, credentials: dict) -> dict:
        raise not_supported("refresh_credentials")

    def start_realtime(self, credentials: dict) -> None:
        raise not_supported("start_realtime")

    def stop_realtime(self, credentials: dict) -> None:
        raise not_supported("stop_realtime")
