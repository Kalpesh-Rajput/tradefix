from datetime import datetime

from pydantic import BaseModel


class InstrumentStatusOut(BaseModel):
    symbol: str
    asset_class: str
    source: str
    enabled: bool
    covered_from: int | None
    covered_to: int | None
    row_count: int
    gap_minutes: int
    outliers: int
    updated_at: datetime | None


class FailedJobOut(BaseModel):
    id: str
    type: str
    error_code: str | None
    error_message: str | None
    created_at: datetime | None


class DataStatusOut(BaseModel):
    instruments: list[InstrumentStatusOut]
    failures: list[FailedJobOut]


class BackfillIn(BaseModel):
    symbol: str
    start_ms: int
    end_ms: int


class BackfillOut(BaseModel):
    job_id: str
    created: bool


class AliasIn(BaseModel):
    broker: str
    raw_symbol: str
    canonical: str


class AliasOut(BaseModel):
    id: str
    broker: str
    raw_symbol: str
    canonical_symbol: str


class UnresolvedOut(BaseModel):
    id: str
    broker: str
    raw_symbol: str
    count: int
    interest_count: int
    last_seen: datetime | None


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
