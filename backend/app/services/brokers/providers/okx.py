"""OKX V5. Docs: https://www.okx.com/docs-v5/en/ verified 2026-10-06."""

from __future__ import annotations

from datetime import datetime, timezone
from urllib.parse import urlencode

from app.services.brokers.base import BaseBrokerConnector
from app.services.brokers.canonical import CanonicalAccount, CanonicalExecution, D, as_utc
from app.services.brokers.limits import limit_for
from app.services.brokers.errors import BrokerError
from app.services.brokers.http import ProviderHttp
from app.services.brokers.signing import okx_signature
from app.services.brokers.windows import chunk_range


class OkxConnector(BaseBrokerConnector):
    provider_id = "okx"

    def __init__(self) -> None:
        self.http = ProviderHttp("okx", min_interval=0.15)

    def validate(self, credentials: dict) -> CanonicalAccount:
        data = self._get(credentials, "/api/v5/account/balance", "")
        rows = (data.get("data") or [{}])[0]
        details = rows.get("details") or []
        usdt = next((row for row in details if row.get("ccy") == "USDT"), None)
        return CanonicalAccount(
            external_account_id=str(rows.get("uid") or "okx"),
            currency="USDT",
            balance=D(usdt.get("cashBal")) if usdt else D(rows.get("totalEq")),
            equity=D(rows.get("totalEq")) if rows.get("totalEq") else None,
            account_type=str(credentials.get("environment") or "live"),
            raw={"instrument_type": credentials.get("instrument_type")},
        )

    def fetch_executions(self, credentials, start, end, on_batch, resume=None) -> None:
        inst = str(credentials.get("instrument_type") or "SPOT")
        if inst == "OPTIONS":
            raise BrokerError("NOT_SUPPORTED", "OKX options are not represented in the journal yet.")
        limits = limit_for("okx")
        if limits.history_window is None:
            raise BrokerError("HISTORICAL_LIMIT", "OKX history window is not configured.")
        windows = chunk_range(as_utc(start), as_utc(end), window=limits.history_window)
        start_index = int((resume or {}).get("window") or 0)
        for index, (window_start, window_end) in enumerate(windows):
            if index < start_index:
                continue
            after = None
            while True:
                params = {
                    "instType": inst,
                    "begin": str(int(window_start.timestamp() * 1000)),
                    "end": str(int(window_end.timestamp() * 1000)),
                    "limit": str(limits.page_size),
                }
                if after:
                    params["after"] = after
                query = urlencode(params)
                data = self._get(credentials, "/api/v5/trade/fills-history", query)
                rows = data.get("data") or []
                batch = [self._fill(row) for row in rows]
                after = str(rows[-1].get("billId") or rows[-1].get("tradeId") or "") if rows else None
                on_batch(batch, {"window": index, "after": after, "stream": "fills"})
                if len(rows) < 100 or not after:
                    break
            on_batch([], {"window": index + 1, "stream": "fills"})

    def _fill(self, row: dict) -> CanonicalExecution:
        stamp = int(row.get("fillTime") or row.get("ts") or 0)
        when = datetime.fromtimestamp(stamp / 1000, tz=timezone.utc)
        return CanonicalExecution(
            external_execution_id=str(row.get("tradeId") or row.get("billId")),
            external_order_id=str(row.get("ordId") or "") or None,
            provider_symbol=str(row.get("instId") or ""),
            side=str(row.get("side") or "").lower(),
            quantity=D(row.get("fillSz")),
            price=D(row.get("fillPx")),
            commission=D(row.get("fee")).copy_abs(),
            executed_at=when,
            currency=str(row.get("feeCcy") or "USDT"),
            raw=row,
        )

    def _get(self, credentials: dict, path: str, query: str) -> dict:
        if not credentials.get("passphrase"):
            raise BrokerError("INVALID_CREDENTIALS", "OKX passphrase is required.")
        timestamp = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
        request_path = f"{path}?{query}" if query else path
        signature = okx_signature(
            secret=str(credentials["api_secret"]),
            timestamp=timestamp,
            method="GET",
            path=request_path,
            body="",
        )
        headers = {
            "OK-ACCESS-KEY": str(credentials["api_key"]),
            "OK-ACCESS-SIGN": signature,
            "OK-ACCESS-TIMESTAMP": timestamp,
            "OK-ACCESS-PASSPHRASE": str(credentials["passphrase"]),
        }
        if str(credentials.get("environment") or "live") == "demo":
            headers["x-simulated-trading"] = "1"
        data = self.http.request("GET", f"https://www.okx.com{request_path}", headers=headers)
        if isinstance(data, dict) and str(data.get("code")) not in {"0", "None"}:
            raise BrokerError("API_UNAVAILABLE", f"OKX code {data.get('code')}.")
        return data or {}
