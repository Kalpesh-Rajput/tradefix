"""cTrader Open API. OAuth plus JSON on port 5036.

Docs: https://help.ctrader.com/open-api/ verified 2026-10-06.
Payload type numbers are from spotware/openapi-proto-messages OpenApiModelMessages.proto.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from urllib.parse import urlencode

from app.core.config import settings
from app.services.brokers.base import BaseBrokerConnector
from app.services.brokers.canonical import CanonicalAccount, CanonicalExecution, D
from app.services.brokers.errors import BrokerError
from app.services.brokers.http import ProviderHttp

AUTH_URL = "https://id.ctrader.com/my/settings/openapi/grantingaccess/"
TOKEN_URL = "https://openapi.ctrader.com/apps/token"
PRICE_SCALE = Decimal("100000")

APPLICATION_AUTH_REQ = 2100
APPLICATION_AUTH_RES = 2101
ACCOUNT_AUTH_REQ = 2102
ACCOUNT_AUTH_RES = 2103
RECONCILE_RES = 2125
DEAL_LIST_REQ = 2133
DEAL_LIST_RES = 2134
ERROR_RES = 2142
GET_ACCOUNTS_REQ = 2149
GET_ACCOUNTS_RES = 2150


def authorize_url(state: str, environment: str) -> str:
    if not settings.ctrader_client_id or not settings.ctrader_redirect_uri:
        raise BrokerError(
            "API_UNAVAILABLE",
            "cTrader OAuth is not configured. Set CTRADER_CLIENT_ID and CTRADER_REDIRECT_URI.",
            http_status=503,
        )
    query = urlencode(
        {
            "client_id": settings.ctrader_client_id,
            "redirect_uri": settings.ctrader_redirect_uri,
            "scope": "accounts",
            "state": state,
            "product": "web",
        }
    )
    return f"{AUTH_URL}?{query}"


class CTraderConnector(BaseBrokerConnector):
    provider_id = "ctrader"

    def __init__(self) -> None:
        self.http = ProviderHttp("ctrader", min_interval=0.0)

    def exchange_code(self, code: str) -> dict:
        if not settings.ctrader_client_id or not settings.ctrader_client_secret:
            raise BrokerError("API_UNAVAILABLE", "cTrader client secret is not configured.", http_status=503)
        data = self.http.request(
            "GET",
            TOKEN_URL,
            params={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.ctrader_redirect_uri,
                "client_id": settings.ctrader_client_id,
                "client_secret": settings.ctrader_client_secret,
            },
        )
        if not isinstance(data, dict) or not data.get("accessToken"):
            raise BrokerError("AUTHORIZATION_REQUIRED", "cTrader did not return an access token.")
        return data

    def refresh_credentials(self, credentials: dict) -> dict:
        token = str(credentials.get("refresh_token") or "")
        if not token:
            raise BrokerError("TOKEN_EXPIRED", "cTrader did not return a refresh token.")
        return self.refresh(token)

    def refresh(self, refresh_token: str) -> dict:
        data = self.http.request(
            "GET",
            TOKEN_URL,
            params={
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "client_id": settings.ctrader_client_id,
                "client_secret": settings.ctrader_client_secret,
            },
        )
        if not isinstance(data, dict) or not data.get("accessToken"):
            raise BrokerError("TOKEN_EXPIRED", "cTrader refresh failed.")
        return data

    def validate(self, credentials: dict) -> CanonicalAccount:
        accounts = self.list_accounts(credentials)
        if not accounts:
            raise BrokerError("ACCOUNT_NOT_FOUND", "cTrader returned no trading accounts for this token.")
        return accounts[0]

    def list_accounts(self, credentials: dict) -> list[CanonicalAccount]:
        host = _host(str(credentials.get("environment") or "demo"))
        messages = _session(
            host,
            [
                {"payloadType": APPLICATION_AUTH_REQ, "payload": _app_auth()},
                {"payloadType": GET_ACCOUNTS_REQ, "payload": {"accessToken": credentials.get("access_token")}},
            ],
        )
        accounts: list[CanonicalAccount] = []
        for message in messages:
            if message.get("payloadType") == ERROR_RES:
                raise BrokerError("AUTHORIZATION_REQUIRED", "cTrader rejected the application or token.")
            payload = message.get("payload") or {}
            for row in payload.get("ctidTraderAccount") or []:
                account_id = str(row.get("ctidTraderAccountId") or "")
                if not account_id:
                    continue
                accounts.append(
                    CanonicalAccount(
                        external_account_id=account_id,
                        currency="USD",
                        account_type="demo" if row.get("isLive") is False else "live",
                        raw=row,
                    )
                )
        return accounts

    def fetch_executions(self, credentials, start, end, on_batch, resume=None) -> None:
        account_id = str(credentials.get("external_account_id") or "")
        if not account_id:
            found = self.list_accounts(credentials)
            if not found:
                raise BrokerError("ACCOUNT_NOT_FOUND", "No cTrader account to sync.")
            account_id = found[0].external_account_id
        host = _host(str(credentials.get("environment") or "demo"))
        messages = _session(
            host,
            [
                {"payloadType": APPLICATION_AUTH_REQ, "payload": _app_auth()},
                {
                    "payloadType": ACCOUNT_AUTH_REQ,
                    "payload": {"ctidTraderAccountId": int(account_id), "accessToken": credentials.get("access_token")},
                },
                {
                    "payloadType": DEAL_LIST_REQ,
                    "payload": {
                        "ctidTraderAccountId": int(account_id),
                        "fromTimestamp": int(start.timestamp() * 1000),
                        "toTimestamp": int(end.timestamp() * 1000),
                    },
                },
            ],
        )
        batch: list[CanonicalExecution] = []
        for message in messages:
            if message.get("payloadType") == ERROR_RES:
                raise BrokerError("API_UNAVAILABLE", "cTrader deal history request failed.")
            if message.get("payloadType") != DEAL_LIST_RES:
                continue
            for deal in (message.get("payload") or {}).get("deal") or []:
                deal_id = str(deal.get("dealId") or "")
                if not deal_id:
                    continue
                when = datetime.fromtimestamp(int(deal.get("executionTimestamp") or deal.get("createTimestamp") or 0) / 1000, tz=timezone.utc)
                batch.append(
                    CanonicalExecution(
                        external_execution_id=deal_id,
                        external_order_id=str(deal.get("orderId") or "") or None,
                        external_position_id=str(deal.get("positionId") or "") or None,
                        provider_symbol=str(deal.get("symbolName") or deal.get("symbolId") or ""),
                        side="buy" if int(deal.get("tradeSide") or 1) == 1 else "sell",
                        quantity=D(deal.get("volume")) / Decimal("100"),
                        price=D(deal.get("executionPrice")) / PRICE_SCALE,
                        commission=D(deal.get("commission")) / Decimal("100"),
                        swap=D(deal.get("swap")) / Decimal("100"),
                        executed_at=when,
                        raw=deal,
                    )
                )
        on_batch(batch, {"done": True, "account": account_id})


def _app_auth() -> dict:
    if not settings.ctrader_client_id or not settings.ctrader_client_secret:
        raise BrokerError("API_UNAVAILABLE", "cTrader application credentials are not configured.", http_status=503)
    return {"clientId": settings.ctrader_client_id, "clientSecret": settings.ctrader_client_secret}


def _host(environment: str) -> str:
    if environment == "live":
        return "live.ctraderapi.com"
    return "demo.ctraderapi.com"


def _session(host: str, requests: list[dict]) -> list[dict]:
    try:
        import asyncio

        import websockets
    except ImportError as exc:
        raise BrokerError("API_UNAVAILABLE", "The websockets package is required for cTrader.") from exc

    async def _run() -> list[dict]:
        url = f"wss://{host}:5036"
        received: list[dict] = []
        async with websockets.connect(url, open_timeout=20, close_timeout=5) as socket:
            for request in requests:
                request.setdefault("clientMsgId", uuid.uuid4().hex)
                await socket.send(json.dumps(request))
                raw = await asyncio.wait_for(socket.recv(), timeout=20)
                message = json.loads(raw)
                received.append(message)
                if message.get("payloadType") == ERROR_RES:
                    return received
            try:
                while True:
                    raw = await asyncio.wait_for(socket.recv(), timeout=3)
                    received.append(json.loads(raw))
                    if any(item.get("payloadType") == DEAL_LIST_RES for item in received):
                        break
            except (asyncio.TimeoutError, Exception):
                return received
        return received

    return asyncio.run(_run())
