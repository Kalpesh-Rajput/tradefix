"""Bitget API V2. Docs: https://www.bitget.com/api-doc/common/intro verified 2026-10-06."""

from __future__ import annotations

import time
from datetime import datetime, timezone
from urllib.parse import urlencode

from app.services.brokers.base import BaseBrokerConnector
from app.services.brokers.canonical import CanonicalAccount, CanonicalExecution, D, as_utc
from app.services.brokers.limits import limit_for
from app.services.brokers.errors import BrokerError
from app.services.brokers.http import ProviderHttp
from app.services.brokers.signing import bitget_signature
from app.services.brokers.windows import chunk_range


class BitgetConnector(BaseBrokerConnector):
    provider_id = "bitget"

    def __init__(self) -> None:
        self.http = ProviderHttp("bitget", min_interval=0.15)

    def validate(self, credentials: dict) -> CanonicalAccount:
        product = str(credentials.get("product_type") or "spot")
        if product == "spot":
            data = self._get(credentials, "/api/v2/spot/account/assets", {})
            rows = data.get("data") or []
            usdt = next((row for row in rows if row.get("coin") == "USDT"), None)
            balance = D(usdt.get("available")) + D(usdt.get("frozen")) if usdt else None
        else:
            data = self._get(credentials, "/api/v2/mix/account/accounts", {"productType": product})
            rows = data.get("data") or []
            first = rows[0] if rows else {}
            balance = D(first.get("available")) if first else None
        return CanonicalAccount(
            external_account_id=f"bitget-{product}",
            currency="USDT",
            balance=balance,
            account_type=product,
            raw={"permission_check": "not_exposed"},
        )

    def fetch_executions(self, credentials, start, end, on_batch, resume=None) -> None:
        product = str(credentials.get("product_type") or "spot")
        limits = limit_for("bitget")
        if limits.history_window is None:
            raise BrokerError("HISTORICAL_LIMIT", "Bitget history window is not configured.")
        windows = chunk_range(as_utc(start), as_utc(end), window=limits.history_window)
        start_index = int((resume or {}).get("window") or 0)
        for index, (window_start, window_end) in enumerate(windows):
            if index < start_index:
                continue
            id_less = None
            while True:
                params = {
                    "startTime": str(int(window_start.timestamp() * 1000)),
                    "endTime": str(int(window_end.timestamp() * 1000)),
                    "limit": str(limits.page_size),
                }
                if product == "spot":
                    path = "/api/v2/spot/trade/fills"
                else:
                    path = "/api/v2/mix/order/fills"
                    params["productType"] = product
                if id_less:
                    params["idLessThan"] = id_less
                data = self._get(credentials, path, params)
                rows = data.get("data") or []
                if isinstance(rows, dict):
                    rows = rows.get("fillList") or rows.get("list") or []
                batch = [self._row(row) for row in rows if isinstance(row, dict)]
                id_less = str(rows[-1].get("tradeId") or rows[-1].get("fillId") or "") if rows else None
                on_batch(batch, {"window": index, "id_less": id_less})
                if len(rows) < 100 or not id_less:
                    break
            on_batch([], {"window": index + 1})

    def _row(self, row: dict) -> CanonicalExecution:
        stamp = int(row.get("cTime") or row.get("uTime") or row.get("fillTime") or 0)
        when = datetime.fromtimestamp(stamp / 1000, tz=timezone.utc) if stamp else datetime.now(timezone.utc)
        trade_id = str(row.get("tradeId") or row.get("fillId") or "")
        if not trade_id:
            raise BrokerError("UNKNOWN_ERROR", "Bitget fill had no trade id.")
        return CanonicalExecution(
            external_execution_id=trade_id,
            external_order_id=str(row.get("orderId") or "") or None,
            provider_symbol=str(row.get("symbol") or ""),
            side=str(row.get("side") or "").lower(),
            quantity=D(row.get("size") or row.get("baseVolume") or row.get("qty")),
            price=D(row.get("price") or row.get("fillPrice")),
            commission=D(row.get("fee") or row.get("fees")),
            executed_at=when,
            currency=str(row.get("feeCoin") or "USDT"),
            raw=row,
        )

    def _get(self, credentials: dict, path: str, params: dict) -> dict:
        if not credentials.get("passphrase"):
            raise BrokerError("INVALID_CREDENTIALS", "Bitget passphrase is required.")
        timestamp = str(int(time.time() * 1000))
        query = urlencode(params)
        signature = bitget_signature(
            secret=str(credentials["api_secret"]),
            timestamp=timestamp,
            method="GET",
            path=path,
            query=query,
            body="",
        )
        headers = {
            "ACCESS-KEY": str(credentials["api_key"]),
            "ACCESS-SIGN": signature,
            "ACCESS-TIMESTAMP": timestamp,
            "ACCESS-PASSPHRASE": str(credentials["passphrase"]),
            "locale": "en-US",
            "Content-Type": "application/json",
        }
        data = self.http.request("GET", f"https://api.bitget.com{path}", headers=headers, params=params)
        if isinstance(data, dict) and str(data.get("code")) not in {"00000", "0", "None"}:
            raise BrokerError("API_UNAVAILABLE", f"Bitget code {data.get('code')}.")
        return data or {}
