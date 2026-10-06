"""Binance spot and futures. Docs: https://developers.binance.com/docs/binance-spot-api-docs verified 2026-10-06."""

from __future__ import annotations

import time
from datetime import datetime, timezone
from decimal import Decimal
from typing import Callable
from urllib.parse import urlencode

from app.services.brokers.base import BaseBrokerConnector
from app.services.brokers.canonical import CanonicalAccount, CanonicalExecution, D, as_utc
from app.services.brokers.limits import limit_for
from app.services.brokers.errors import BrokerError
from app.services.brokers.http import ProviderHttp
from app.services.brokers.signing import binance_signature

_BASES = {
    ("spot", "live"): "https://api.binance.com",
    ("spot", "testnet"): "https://testnet.binance.vision",
    ("usdt_m", "live"): "https://fapi.binance.com",
    ("usdt_m", "testnet"): "https://testnet.binancefuture.com",
    ("coin_m", "live"): "https://dapi.binance.com",
}

_QUOTES = ("USDT", "FDUSD", "USDC", "BTC")


class BinanceConnector(BaseBrokerConnector):
    provider_id = "binance"

    def __init__(self) -> None:
        self.http = ProviderHttp("binance", min_interval=0.15)

    def validate(self, credentials: dict) -> CanonicalAccount:
        market, env, base = self._target(credentials)
        if market == "spot":
            self._check_restrictions(base, credentials)
            account = self._signed(base, "/api/v3/account", credentials)
            balances = account.get("balances") or []
            quote = next((row for row in balances if row.get("asset") == "USDT"), None)
            balance = D(quote.get("free")) + D(quote.get("locked")) if quote else None
            return CanonicalAccount(
                external_account_id=str(account.get("uid") or account.get("accountType") or "spot"),
                currency="USDT",
                balance=balance,
                account_type=str(account.get("accountType") or "SPOT"),
                permissions={"canTrade": bool(account.get("canTrade"))},
                raw={"market": market, "environment": env},
            )
        path = "/fapi/v2/account" if market == "usdt_m" else "/dapi/v1/account"
        account = self._signed(base, path, credentials)
        assets = account.get("assets") or []
        usdt = next((row for row in assets if row.get("asset") in {"USDT", "USD"}), None)
        return CanonicalAccount(
            external_account_id=str(account.get("accountAlias") or market),
            currency="USDT" if market == "usdt_m" else "USD",
            balance=D(usdt.get("walletBalance")) if usdt else None,
            equity=D(usdt.get("marginBalance")) if usdt else None,
            account_type=market,
            raw={"market": market, "environment": env},
        )

    def fetch_executions(self, credentials, start, end, on_batch, resume=None) -> None:
        market, _env, base = self._target(credentials)
        symbols = self._discover_symbols(credentials, base, market)
        if not symbols:
            raise BrokerError(
                "HISTORICAL_LIMIT",
                "Binance spot and futures trade history is symbol-specific and no traded symbols could be discovered from this account.",
            )
        start_ms = int(as_utc(start).timestamp() * 1000)
        end_ms = int(as_utc(end).timestamp() * 1000)
        done = set((resume or {}).get("symbols") or [])
        path = {
            "spot": "/api/v3/myTrades",
            "usdt_m": "/fapi/v1/userTrades",
            "coin_m": "/dapi/v1/userTrades",
        }[market]
        for symbol in symbols:
            if symbol in done:
                continue
            from_id = None
            while True:
                params: dict[str, object] = {"symbol": symbol, "startTime": start_ms, "endTime": end_ms, "limit": limit_for("binance").page_size}
                if from_id is not None:
                    params = {"symbol": symbol, "fromId": from_id, "limit": limit_for("binance").page_size}
                rows = self._signed(base, path, credentials, params) or []
                if not isinstance(rows, list) or not rows:
                    break
                batch = [self._row(row, market) for row in rows]
                done.add(symbol) if len(rows) < 1000 else None
                on_batch(batch, {"symbols": sorted(done), "open_symbol": symbol, "from_id": rows[-1].get("id")})
                if len(rows) < 1000:
                    break
                last_id = rows[-1].get("id")
                if last_id is None or last_id == from_id:
                    break
                from_id = int(last_id) + 1
            if symbol not in done:
                done.add(symbol)
                on_batch([], {"symbols": sorted(done)})

    def _discover_symbols(self, credentials: dict, base: str, market: str) -> list[str]:
        found: list[str] = []
        if market == "spot":
            account = self._signed(base, "/api/v3/account", credentials)
            assets = []
            for row in account.get("balances") or []:
                if D(row.get("free")) + D(row.get("locked")) > 0:
                    assets.append(str(row.get("asset")))
            for asset in assets:
                if asset in _QUOTES:
                    continue
                for quote in ("USDT", "FDUSD", "USDC"):
                    found.append(f"{asset}{quote}")
        else:
            path = "/fapi/v2/positionRisk" if market == "usdt_m" else "/dapi/v1/positionRisk"
            rows = self._signed(base, path, credentials) or []
            for row in rows:
                if D(row.get("positionAmt")) != 0 and row.get("symbol"):
                    found.append(str(row["symbol"]))
        # Preserve order, drop duplicates. Balances miss flat symbols; that limit is documented.
        seen: set[str] = set()
        ordered: list[str] = []
        for symbol in found:
            if symbol not in seen:
                seen.add(symbol)
                ordered.append(symbol)
        return ordered[:50]

    def _row(self, row: dict, market: str) -> CanonicalExecution:
        qty = D(row.get("qty") or row.get("quantity"))
        price = D(row.get("price"))
        commission = D(row.get("commission"))
        side = "buy" if row.get("isBuyer") or str(row.get("side", "")).upper() == "BUY" else "sell"
        when = datetime.fromtimestamp(int(row.get("time") or 0) / 1000, tz=timezone.utc)
        trade_id = str(row.get("id") or row.get("tradeId"))
        return CanonicalExecution(
            external_execution_id=f"{market}:{row.get('symbol')}:{trade_id}",
            external_order_id=str(row.get("orderId") or "") or None,
            provider_symbol=str(row.get("symbol") or ""),
            side=side,
            quantity=qty,
            price=price,
            commission=commission,
            executed_at=when,
            currency="USDT",
            raw=row,
        )

    def _check_restrictions(self, base: str, credentials: dict) -> None:
        if "testnet" in base:
            return
        data = self._signed(base, "/sapi/v1/account/apiRestrictions", credentials)
        if data.get("enableWithdrawals"):
            raise BrokerError(
                "WITHDRAWAL_PERMISSION_ENABLED",
                "This Binance key can withdraw. Create a read-only key. It was not saved.",
            )
        if data.get("enableReading") is False:
            raise BrokerError("PERMISSION_DENIED", "This Binance key cannot read account data.")

    def _target(self, credentials: dict) -> tuple[str, str, str]:
        market = str(credentials.get("market") or "spot")
        env = str(credentials.get("environment") or "live")
        base = _BASES.get((market, env))
        if base is None:
            raise BrokerError("NOT_SUPPORTED", f"Binance {market} {env} is not a verified endpoint in this build.")
        return market, env, base

    def _signed(self, base: str, path: str, credentials: dict, extra: dict | None = None) -> dict | list:
        params: dict[str, object] = {"timestamp": int(time.time() * 1000), "recvWindow": limit_for("binance").recv_window_ms}
        if extra:
            params.update(extra)
        params["signature"] = binance_signature(str(credentials["api_secret"]), params)
        return self.http.request(
            "GET",
            f"{base}{path}?{urlencode(params)}",
            headers={"X-MBX-APIKEY": str(credentials["api_key"])},
        )

    def user_stream_request(self, credentials: dict) -> dict:
        """Payload for wss://ws-api.binance.com:443/ws-api/v3 userDataStream.subscribe.signature.

        listenKey was removed on 2026-02-20. HMAC keys sign this method.
        """
        params = {"apiKey": str(credentials["api_key"]), "timestamp": int(time.time() * 1000)}
        params["signature"] = binance_signature(str(credentials["api_secret"]), params)
        return {"id": str(params["timestamp"]), "method": "userDataStream.subscribe.signature", "params": params}
