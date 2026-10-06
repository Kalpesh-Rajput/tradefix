"""MT4/MT5 via the existing TradeFix-Connectors HTTP bridge. No MetaApi.

One bridge process serves the terminal session it was started with. This client
does not pretend a single terminal can hold every user's login.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.core.config import settings
from app.services.brokers.base import BaseBrokerConnector
from app.services.brokers.canonical import CanonicalAccount, CanonicalExecution, D
from app.services.brokers.errors import BrokerError
from app.services.brokers.http import ProviderHttp

_MT_PROVIDERS = {"mt5": "mt5", "mt4": "mt4", "xm": "mt5", "exness": "exness", "avatrade": "mt5"}


class MtBridgeConnector(BaseBrokerConnector):
    def __init__(self, provider_id: str) -> None:
        self.provider_id = provider_id
        self.http = ProviderHttp("mt-bridge", min_interval=0.0)

    def validate(self, credentials: dict) -> CanonicalAccount:
        base = self._base()
        payload = self._connect_body(credentials)
        data = self.http.request(
            "POST",
            f"{base}/api/broker/connect",
            headers=self._headers(),
            json_body=payload,
        )
        account = (data or {}).get("account") or {}
        login = str(account.get("account_number") or credentials.get("login") or "")
        if not login:
            raise BrokerError("ACCOUNT_NOT_FOUND", "The bridge did not return an account.")
        connection_id = str((data or {}).get("connection_id") or "")
        return CanonicalAccount(
            external_account_id=login,
            currency=str(account.get("currency") or "USD"),
            balance=D(account.get("balance")) if account.get("balance") is not None else None,
            equity=D(account.get("equity")) if account.get("equity") is not None else None,
            account_type=str(credentials.get("platform") or self.provider_id),
            leverage=D(account.get("leverage")) if account.get("leverage") else None,
            raw={"bridge_connection_id": connection_id, "server": account.get("server")},
        )

    def fetch_executions(self, credentials, start, end, on_batch, resume=None) -> None:
        bridge_id = str(credentials.get("bridge_connection_id") or "")
        if not bridge_id:
            account = self.validate(credentials)
            bridge_id = str(account.raw.get("bridge_connection_id") or "")
            credentials["bridge_connection_id"] = bridge_id
        if not bridge_id:
            raise BrokerError("API_UNAVAILABLE", "The MT bridge did not return a connection id.")
        base = self._base()
        self.http.request(
            "POST",
            f"{base}/api/broker/sync",
            headers=self._headers(),
            json_body={"connection_id": bridge_id},
        )
        data = self.http.request(
            "GET",
            f"{base}/api/broker/trades",
            headers=self._headers(),
            params={"connection_id": bridge_id},
        )
        trades = (data or {}).get("trades") or []
        batch: list[CanonicalExecution] = []
        for trade in trades:
            batch.extend(self._to_executions(trade, start, end))
        on_batch(batch, {"done": True})

    def _to_executions(self, trade: dict, start: datetime, end: datetime) -> list[CanonicalExecution]:
        trade_id = str(trade.get("tradeId") or "")
        if not trade_id:
            return []
        entry_at = _parse(trade.get("entryDate"))
        if entry_at < start or entry_at > end:
            return []
        symbol = str(trade.get("symbol") or "")
        side = "buy" if str(trade.get("longOrShort") or "").lower() == "long" else "sell"
        qty = D(trade.get("buyingQuantity"))
        entry = CanonicalExecution(
            external_execution_id=f"{trade_id}:entry",
            external_position_id=trade_id,
            provider_symbol=symbol,
            side=side,
            quantity=qty,
            price=D(trade.get("buyingPrice")),
            executed_at=entry_at,
            commission=D(trade.get("commission")),
            swap=D(trade.get("swap")),
            currency="USD",
            raw=trade,
            identity_rank=1,
        )
        rows = [entry]
        exit_raw = trade.get("exitDate")
        if exit_raw and trade.get("sellPrice") is not None:
            exit_side = "sell" if side == "buy" else "buy"
            rows.append(
                CanonicalExecution(
                    external_execution_id=f"{trade_id}:exit",
                    external_position_id=trade_id,
                    provider_symbol=symbol,
                    side=exit_side,
                    quantity=qty,
                    price=D(trade.get("sellPrice")),
                    executed_at=_parse(exit_raw),
                    currency="USD",
                    raw={"leg": "exit", "tradeId": trade_id},
                    identity_rank=1,
                )
            )
        return rows

    def _connect_body(self, credentials: dict) -> dict:
        platform = str(credentials.get("platform") or _MT_PROVIDERS.get(self.provider_id) or "mt5")
        broker = "mt5" if platform == "mt5" else "mt4" if platform == "mt4" else _MT_PROVIDERS.get(self.provider_id, "mt5")
        if self.provider_id == "exness":
            broker = "exness"
        try:
            login = int(str(credentials.get("login") or "0"))
        except ValueError as exc:
            raise BrokerError("INVALID_CREDENTIALS", "MT login must be a whole number.") from exc
        if login <= 0 or not credentials.get("password") or not credentials.get("server"):
            raise BrokerError("INVALID_CREDENTIALS", "Login, investor password, and server are required.")
        return {"broker": broker, "login": login, "password": str(credentials["password"]), "server": str(credentials["server"])}

    def _base(self) -> str:
        base = (settings.tradefix_mt_bridge_url or "").rstrip("/")
        if not base:
            raise BrokerError(
                "BRIDGE_NOT_CONFIGURED",
                "MetaTrader sync is not configured. Set TRADEFIX_MT_BRIDGE_URL to the existing TradeFix-Connectors service.",
            )
        return base

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        token = (settings.tradefix_mt_bridge_token or "").strip()
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers


def _parse(value: object) -> datetime:
    text = str(value or "")
    if text.endswith("Z"):
        text = text.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return datetime.now(timezone.utc)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed
