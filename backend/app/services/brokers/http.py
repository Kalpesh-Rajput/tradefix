"""Shared HTTP client: timeouts, Retry-After, capped retries, no auth retry."""

from __future__ import annotations

import random
import time
from typing import Any

import httpx

from app.services.brokers.errors import BrokerError

_RETRYABLE = {429, 500, 502, 503, 504}


class ProviderHttp:
    def __init__(self, provider: str, *, min_interval: float = 0.2, timeout: float = 20.0, budget: int | None = 2000) -> None:
        self.provider = provider
        self.min_interval = min_interval
        self.timeout = timeout
        self.budget = budget
        self._used = 0
        self._last = 0.0

    def request(
        self,
        method: str,
        url: str,
        *,
        headers: dict[str, str] | None = None,
        params: dict[str, Any] | None = None,
        json_body: dict | None = None,
        max_attempts: int = 4,
    ) -> Any:
        attempt = 0
        while True:
            attempt += 1
            if self.budget is not None and self._used >= self.budget:
                raise BrokerError("RATE_LIMITED", f"{self.provider} sync stopped at its request budget.")
            self._used += 1
            self._pace()
            try:
                response = httpx.request(
                    method,
                    url,
                    headers=headers,
                    params=params,
                    json=json_body,
                    timeout=self.timeout,
                )
            except httpx.TimeoutException as exc:
                if attempt >= max_attempts:
                    raise BrokerError("NETWORK_ERROR", f"{self.provider} timed out.") from exc
                self._sleep_backoff(attempt)
                continue
            except httpx.HTTPError as exc:
                if attempt >= max_attempts:
                    raise BrokerError("NETWORK_ERROR", f"{self.provider} could not be reached.") from exc
                self._sleep_backoff(attempt)
                continue

            if response.status_code in (401, 403):
                self._raise_auth(response)
            if response.status_code == 429 or response.status_code in _RETRYABLE:
                if attempt >= max_attempts:
                    code = "RATE_LIMITED" if response.status_code == 429 else "API_UNAVAILABLE"
                    raise BrokerError(code, f"{self.provider} returned HTTP {response.status_code}.")
                self._sleep_backoff(attempt, response)
                continue
            if response.status_code >= 400:
                raise BrokerError("API_UNAVAILABLE", f"{self.provider} returned HTTP {response.status_code}.")
            if not response.content:
                return None
            return response.json()

    def _raise_auth(self, response: httpx.Response) -> None:
        text = (response.text or "")[:180].lower()
        if "whitelist" in text or "ip" in text and "not" in text:
            raise BrokerError("IP_NOT_WHITELISTED", f"Allow this server IP on the {self.provider} key.")
        if response.status_code == 403:
            raise BrokerError("PERMISSION_DENIED", f"{self.provider} refused this key.")
        raise BrokerError("INVALID_CREDENTIALS", f"{self.provider} rejected the credentials.")

    def _pace(self) -> None:
        wait = self.min_interval - (time.monotonic() - self._last)
        if wait > 0:
            time.sleep(wait)
        self._last = time.monotonic()

    def _sleep_backoff(self, attempt: int, response: httpx.Response | None = None) -> None:
        retry_after = 0.0
        if response is not None:
            raw = response.headers.get("Retry-After")
            if raw and raw.isdigit():
                retry_after = min(float(raw), 30.0)
        delay = max(retry_after, min(30.0, (2 ** (attempt - 1)) + random.random()))
        time.sleep(delay)
