"""Strip secrets from structures before they are logged or returned."""

from __future__ import annotations

SECRET_KEYS = {
    "password",
    "api_secret",
    "secret",
    "secret_key",
    "passphrase",
    "access_token",
    "refresh_token",
    "authorization",
    "api_key",
    "client_secret",
    "ciphertext",
    "signature",
}


def redact(value: object) -> object:
    if isinstance(value, dict):
        cleaned: dict[object, object] = {}
        for key, item in value.items():
            if str(key).lower() in SECRET_KEYS:
                cleaned[key] = "***"
            else:
                cleaned[key] = redact(item)
        return cleaned
    if isinstance(value, list):
        return [redact(item) for item in value]
    return value


def mask_account_id(value: str | int | None) -> str:
    text = "" if value is None else str(value)
    if len(text) <= 4:
        return "••••"
    return f"••••{text[-4:]}"
