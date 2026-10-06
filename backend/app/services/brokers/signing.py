"""Request signatures taken from current provider docs. Tested against published vectors."""

from __future__ import annotations

import base64
import hashlib
import hmac
from urllib.parse import urlencode


def hmac_sha256_hex(secret: str, message: str) -> str:
    return hmac.new(secret.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).hexdigest()


def hmac_sha256_b64(secret: str, message: str) -> str:
    digest = hmac.new(secret.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).digest()
    return base64.b64encode(digest).decode("ascii")


def binance_signature(secret: str, params: dict[str, object]) -> str:
    query = urlencode([(key, params[key]) for key in params])
    return hmac_sha256_hex(secret, query)


def bybit_signature(*, secret: str, timestamp: str, api_key: str, recv_window: str, payload: str) -> str:
    return hmac_sha256_hex(secret, f"{timestamp}{api_key}{recv_window}{payload}")


def bitget_signature(*, secret: str, timestamp: str, method: str, path: str, query: str, body: str) -> str:
    request_path = path if not query else f"{path}?{query}"
    return hmac_sha256_b64(secret, f"{timestamp}{method.upper()}{request_path}{body}")


def okx_signature(*, secret: str, timestamp: str, method: str, path: str, body: str) -> str:
    return hmac_sha256_b64(secret, f"{timestamp}{method.upper()}{path}{body}")


def delta_signature(*, secret: str, method: str, timestamp: str, path: str, query: str, body: str) -> str:
    # Official prehash: method + timestamp + requestPath + query + body.
    # https://docs.delta.exchange/
    query_part = f"?{query}" if query else ""
    return hmac_sha256_hex(secret, f"{method.upper()}{timestamp}{path}{query_part}{body}")
