"""Provider-independent broker errors. Messages never include secrets or stack traces."""

from __future__ import annotations


class BrokerError(Exception):
    def __init__(self, code: str, message: str, *, http_status: int = 400) -> None:
        self.code = code
        self.message = message
        self.http_status = http_status
        super().__init__(message)

    def as_dict(self) -> dict[str, str]:
        return {"code": self.code, "message": self.message}


class NotSupportedError(BrokerError):
    def __init__(self, message: str) -> None:
        super().__init__("NOT_SUPPORTED", message)


MESSAGES: dict[str, str] = {
    "INVALID_CREDENTIALS": "TradeFix could not authenticate this account. Check the login, key, or server. Nothing was saved.",
    "AUTHORIZATION_REQUIRED": "This connection needs to be authorized again.",
    "PERMISSION_DENIED": "The key does not have permission to read trading history.",
    "WITHDRAWAL_PERMISSION_ENABLED": "This API key can withdraw funds. Create a read-only key and connect again. The key was not saved.",
    "ACCOUNT_NOT_FOUND": "The trading account was not found.",
    "ACCOUNT_UNSUPPORTED": "This account type cannot be synced.",
    "REGION_UNSUPPORTED": "This region is not supported for that provider.",
    "SERVER_NOT_FOUND": "That trade server was not found. Use the exact name from the platform login window.",
    "IP_NOT_WHITELISTED": "The exchange rejected the request because this server IP is not on the key allowlist.",
    "RATE_LIMITED": "The provider rate limit was hit. Sync will retry.",
    "API_UNAVAILABLE": "The provider or bridge did not respond. Sync will retry.",
    "NETWORK_ERROR": "The network request failed. Sync will retry.",
    "TOKEN_EXPIRED": "The authorization expired. Reconnect the account.",
    "INVALID_SERVER": "The server name is not valid.",
    "HISTORICAL_LIMIT": "This provider cannot return that history with the current request. See the limitation on the connect screen.",
    "WEBSOCKET_DISCONNECTED": "The realtime stream disconnected. Reconciliation will fill any gap.",
    "NOT_SUPPORTED": "This provider does not support that action.",
    "UNKNOWN_ERROR": "TradeFix could not complete that request.",
    "BRIDGE_NOT_CONFIGURED": "MetaTrader sync needs the TradeFix bridge URL on the server. It is not configured, so nothing was connected.",
    "SYNC_ALREADY_RUNNING": "A sync is already running for this connection.",
}


def message_for(code: str, detail: str | None = None) -> str:
    base = MESSAGES.get(code, MESSAGES["UNKNOWN_ERROR"])
    if detail and _looks_safe(detail):
        return f"{base} {detail}"
    return base


def _looks_safe(detail: str) -> bool:
    lowered = detail.lower()
    blocked = ("password", "secret", "token", "api_key", "apikey", "passphrase", "bearer ")
    return not any(word in lowered for word in blocked) and len(detail) < 240
