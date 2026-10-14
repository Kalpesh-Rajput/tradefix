"""Stable machine error codes for replay, market data and backtesting (backtesting/03 section 10).

Responses use the app's existing error shape `{"code", "message"}`, plus `details` and `job_id` when set.
"""

from __future__ import annotations

from typing import Any

STATUS_BY_CODE: dict[str, int] = {
    "unresolved_symbol": 422,
    "instrument_not_supported": 422,
    "data_preparing": 202,
    "data_unavailable": 503,
    "range_outside_available_data": 422,
    "limit_exceeded": 422,
    "quota_exceeded": 429,
    "rate_limited": 429,
    "invalid_strategy": 422,
    "job_failed": 500,
    "job_cancelled": 409,
    "feature_not_allowed": 403,
    "not_found": 404,
    "invalid_request": 422,
}


class BacktestError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        *,
        status: int | None = None,
        details: Any = None,
        job_id: str | None = None,
        retry_after_s: int | None = None,
    ) -> None:
        if code not in STATUS_BY_CODE:
            raise ValueError(f"unknown error code {code}")
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status or STATUS_BY_CODE[code]
        self.details = details
        self.job_id = job_id
        self.retry_after_s = retry_after_s

    def as_dict(self) -> dict[str, Any]:
        body: dict[str, Any] = {"code": self.code, "message": self.message}
        if self.details is not None:
            body["details"] = self.details
        if self.job_id is not None:
            body["job_id"] = self.job_id
        return body

    def headers(self) -> dict[str, str]:
        return {"Retry-After": str(self.retry_after_s)} if self.retry_after_s else {}


def not_found(what: str = "Resource") -> BacktestError:
    return BacktestError("not_found", f"{what} not found.")
