"""Delta Exchange. Docs: https://docs.delta.exchange/ verified 2026-10-06."""

from __future__ import annotations

import time
from datetime import datetime, timezone

from app.core.config import settings
from app.services.brokers.base import BaseBrokerConnector
from app.services.brokers.canonical import CanonicalAccount, CanonicalExecution, D
from app.services.brokers.limits import limit_for
from app.services.brokers.errors import BrokerError
from app.services.brokers.http import ProviderHttp
from app.services.brokers.signing import delta_signature

_HOSTS = {
    ("india", "live"): "https://api.india.delta.exchange",
    ("global", "live"): "https://api.delta.exchange",
    ("india", "testnet"): "https://cdn-ind.testnet.deltaex.org",
}


class DeltaConnector(BaseBrokerConnector):
    provider_id = "delta"

    def __init__(self) -> None:
        self.http = ProviderHttp("delta", min_interval=0.2)

    def validate(self, credentials: dict) -> CanonicalAccount:
        host = self._host(credentials)
        data = self._request(credentials, host, "GET", "/v2/wallet/balances", "")
        rows = data if isinstance(data, list) else (data or {}).get("result") or []
        usd = next((row for row in rows if str(row.get("asset_symbol") or row.get("symbol")) in {"USD", "USDT"}), None)
        return CanonicalAccount(
            external_account_id=f"delta-{credentials.get('region')}",
            currency=str((usd or {}).get("asset_symbol") or "USD"),
            balance=D((usd or {}).get("balance") or (usd or {}).get("available_balance")),
            account_type=str(credentials.get("region") or "india"),
            raw={"egress_ip": settings.broker_egress_ip or None},
        )

    def fetch_executions(self, credentials, start, end, on_batch, resume=None) -> None:
        host = self._host(credentials)
        cursor = (resume or {}).get("after")
        pages = 0
        while pages < 500:
            query = f"page_size={limit_for('delta').page_size}"
            if cursor:
                query = f"{query}&after={cursor}"
            data = self._request(credentials, host, "GET", "/v2/fills", query)
            result = data.get("result") if isinstance(data, dict) else data
            rows = result if isinstance(result, list) else []
            batch = []
            for row in rows:
                created = row.get("created_at")
                when = _parse_time(created)
                if when < start or when > end:
                    continue
                fill_id = str(row.get("id") or "")
                if not fill_id:
                    continue
                batch.append(
                    CanonicalExecution(
                        external_execution_id=fill_id,
                        external_order_id=str(row.get("order_id") or "") or None,
                        provider_symbol=str(row.get("product_symbol") or row.get("symbol") or ""),
                        side=str(row.get("side") or "").lower(),
                        quantity=D(row.get("size")),
                        price=D(row.get("price")),
                        commission=D(row.get("commission")),
                        executed_at=when,
                        currency="USD",
                        raw=row,
                    )
                )
            meta = (data or {}).get("meta") if isinstance(data, dict) else {}
            cursor = (meta or {}).get("after")
            on_batch(batch, {"after": cursor, "page": pages})
            pages += 1
            if not cursor or not rows:
                break

    def _host(self, credentials: dict) -> str:
        region = str(credentials.get("region") or "india")
        env = str(credentials.get("environment") or "live")
        host = _HOSTS.get((region, env))
        if host is None:
            raise BrokerError("REGION_UNSUPPORTED", "Delta testnet is verified for India only. Global testnet was not verified.")
        return host

    def _request(self, credentials: dict, host: str, method: str, path: str, query: str) -> dict | list:
        timestamp = str(int(time.time()))
        signature = delta_signature(
            secret=str(credentials["api_secret"]),
            method=method,
            timestamp=timestamp,
            path=path,
            query=query,
            body="",
        )
        headers = {
            "api-key": str(credentials["api_key"]),
            "timestamp": timestamp,
            "signature": signature,
            "User-Agent": "tradefix",
            "Content-Type": "application/json",
        }
        url = f"{host}{path}" if not query else f"{host}{path}?{query}"
        return self.http.request(method, url, headers=headers)


def _parse_time(value: object) -> datetime:
    if isinstance(value, (int, float)):
        stamp = float(value)
        if stamp > 10_000_000_000:
            stamp /= 1000
        return datetime.fromtimestamp(stamp, tz=timezone.utc)
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
