"""Bybit V5. Docs: https://bybit-exchange.github.io/docs/v5/intro verified 2026-10-06."""

from __future__ import annotations

import time
from datetime import datetime, timezone
from urllib.parse import urlencode

from app.services.brokers.base import BaseBrokerConnector
from app.services.brokers.canonical import CanonicalAccount, CanonicalExecution, D, as_utc
from app.services.brokers.limits import limit_for
from app.services.brokers.errors import BrokerError
from app.services.brokers.http import ProviderHttp
from app.services.brokers.signing import bybit_signature
from app.services.brokers.windows import chunk_range

_HOSTS = {
    "live": "https://api.bybit.com",
    "testnet": "https://api-testnet.bybit.com",
}


class BybitConnector(BaseBrokerConnector):
    provider_id = "bybit"

    def __init__(self) -> None:
        self.http = ProviderHttp("bybit", min_interval=0.12)

    def validate(self, credentials: dict) -> CanonicalAccount:
        info = self._get(credentials, "/v5/user/query-api", {})
        result = (info or {}).get("result") or {}
        perms = result.get("permissions") or {}
        if _withdrawal_enabled(perms):
            raise BrokerError("WITHDRAWAL_PERMISSION_ENABLED", "This Bybit key can withdraw. It was not saved.")
        wallet = self._get(credentials, "/v5/account/wallet-balance", {"accountType": "UNIFIED"})
        coins = (((wallet or {}).get("result") or {}).get("list") or [{}])[0].get("coin") or []
        usdt = next((row for row in coins if row.get("coin") == "USDT"), None)
        return CanonicalAccount(
            external_account_id=str(result.get("userID") or result.get("id") or "bybit"),
            currency="USDT",
            balance=D(usdt.get("walletBalance")) if usdt else None,
            equity=D(usdt.get("equity")) if usdt else None,
            account_type=str(result.get("uta") or "detected"),
            permissions={"readOnly": bool(result.get("readOnly"))} if result else {},
            raw={"uta": result.get("uta")},
        )

    def fetch_executions(self, credentials, start, end, on_batch, resume=None) -> None:
        category = str(credentials.get("category") or "linear")
        if category not in {"spot", "linear", "inverse"}:
            raise BrokerError("NOT_SUPPORTED", "Bybit options are not imported.")
        limits = limit_for("bybit")
        if limits.history_window is None:
            raise BrokerError("HISTORICAL_LIMIT", "Bybit history window is not configured.")
        windows = chunk_range(as_utc(start), as_utc(end), window=limits.history_window)
        start_index = int((resume or {}).get("window") or 0)
        for index, (window_start, window_end) in enumerate(windows):
            if index < start_index:
                continue
            cursor = None
            while True:
                params = {
                    "category": category,
                    "startTime": int(window_start.timestamp() * 1000),
                    "endTime": int(window_end.timestamp() * 1000),
                    "limit": limits.page_size,
                }
                if cursor:
                    params["cursor"] = cursor
                payload = self._get(credentials, "/v5/execution/list", params)
                result = (payload or {}).get("result") or {}
                rows = result.get("list") or []
                batch = [self._row(row, category) for row in rows]
                cursor = result.get("nextPageCursor") or None
                on_batch(batch, {"window": index, "cursor": cursor})
                if not cursor or not rows:
                    break
            on_batch([], {"window": index + 1})

    def _row(self, row: dict, category: str) -> CanonicalExecution:
        when = datetime.fromtimestamp(int(row.get("execTime") or 0) / 1000, tz=timezone.utc)
        return CanonicalExecution(
            external_execution_id=str(row.get("execId")),
            external_order_id=str(row.get("orderId") or "") or None,
            provider_symbol=str(row.get("symbol") or ""),
            side=str(row.get("side") or "").lower(),
            quantity=D(row.get("execQty")),
            price=D(row.get("execPrice")),
            commission=D(row.get("execFee")),
            executed_at=when,
            currency=str(row.get("feeCurrency") or "USDT"),
            raw={"category": category, **row},
        )

    def _get(self, credentials: dict, path: str, params: dict) -> dict:
        env = str(credentials.get("environment") or "live")
        host = _HOSTS.get(env)
        if host is None:
            raise BrokerError("NOT_SUPPORTED", "Bybit environment must be live or testnet.")
        timestamp = str(int(time.time() * 1000))
        recv = "5000"
        query = urlencode(params)
        signature = bybit_signature(
            secret=str(credentials["api_secret"]),
            timestamp=timestamp,
            api_key=str(credentials["api_key"]),
            recv_window=recv,
            payload=query,
        )
        headers = {
            "X-BAPI-API-KEY": str(credentials["api_key"]),
            "X-BAPI-TIMESTAMP": timestamp,
            "X-BAPI-RECV-WINDOW": recv,
            "X-BAPI-SIGN": signature,
        }
        data = self.http.request("GET", f"{host}{path}", headers=headers, params=params)
        if isinstance(data, dict) and data.get("retCode") not in (0, "0", None):
            raise BrokerError("API_UNAVAILABLE", f"Bybit retCode {data.get('retCode')}.")
        return data or {}


def _withdrawal_enabled(permissions: dict) -> bool:
    for value in permissions.values():
        if isinstance(value, list) and any("withdraw" in str(item).lower() for item in value):
            return True
        if isinstance(value, str) and "withdraw" in value.lower():
            return True
    return False
