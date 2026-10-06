"""AES-256-GCM credential vault. The connection id is bound as associated data."""

from __future__ import annotations

import base64
import json
import os
import uuid
from datetime import datetime, timezone

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings
from app.services.brokers.errors import BrokerError


def _parse_keys() -> dict[str, bytes]:
    raw = (settings.broker_credentials_keys or "").strip()
    keys: dict[str, bytes] = {}
    if not raw:
        return keys
    for part in raw.split(","):
        piece = part.strip()
        if not piece or ":" not in piece:
            continue
        key_id, encoded = piece.split(":", 1)
        material = base64.b64decode(encoded.strip())
        if len(material) != 32:
            raise BrokerError("UNKNOWN_ERROR", "Broker credential key material must be 32 bytes.")
        keys[key_id.strip()] = material
    return keys


def active_key() -> tuple[str, bytes]:
    keys = _parse_keys()
    key_id = (settings.broker_credentials_active_key or "").strip()
    if not key_id or key_id not in keys:
        raise BrokerError(
            "API_UNAVAILABLE",
            "Broker credential encryption is not configured on this server.",
            http_status=503,
        )
    return key_id, keys[key_id]


def encrypt(payload: dict, connection_id: uuid.UUID) -> tuple[str, bytes, bytes]:
    key_id, key = active_key()
    nonce = os.urandom(12)
    plaintext = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    ciphertext = AESGCM(key).encrypt(nonce, plaintext, connection_id.bytes)
    return key_id, nonce, ciphertext


def rotate(key_id: str, nonce: bytes, ciphertext: bytes, connection_id: uuid.UUID) -> tuple[str, bytes, bytes]:
    """Re-encrypt with the active key. The previous key must stay on the ring until every row is rotated."""
    payload = decrypt(key_id, nonce, ciphertext, connection_id)
    return encrypt(payload, connection_id)


def decrypt(key_id: str, nonce: bytes, ciphertext: bytes, connection_id: uuid.UUID) -> dict:
    keys = _parse_keys()
    key = keys.get(key_id)
    if key is None:
        raise BrokerError("API_UNAVAILABLE", "The credential key for this connection is no longer on the server.", http_status=503)
    plaintext = AESGCM(key).decrypt(nonce, ciphertext, connection_id.bytes)
    data = json.loads(plaintext.decode("utf-8"))
    if not isinstance(data, dict):
        raise BrokerError("UNKNOWN_ERROR", "Stored credentials could not be read.")
    return data


def utcnow() -> datetime:
    return datetime.now(timezone.utc)
