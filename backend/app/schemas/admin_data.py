from datetime import datetime

from pydantic import BaseModel


class TimeOffsetOut(BaseModel):
    account_id: str
    account_name: str
    user_email: str
    broker_account_id: str | None
    tz_kind: str
    tz_value: str
    confidence: str
    match_rate: float
    sample_size: int
    runner_up: str | None
    runner_up_rate: float | None
    method: str
    scores: dict[str, float]
    computed_at: datetime | None
