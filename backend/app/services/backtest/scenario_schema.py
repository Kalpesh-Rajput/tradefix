"""Pydantic validation for the shared scenario fixtures (D-025). Unknown fields are rejected."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

DEFAULT_TOLERANCE = {"price": 1e-8, "pips": 1e-6, "r": 1e-6, "money": 0.005, "ratio": 1e-6}


class Tolerance(BaseModel):
    model_config = ConfigDict(extra="forbid")
    price: float = 1e-8
    pips: float = 1e-6
    r: float = 1e-6
    money: float = 0.005
    ratio: float = 1e-6


class InstrumentIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    symbol: str
    asset_class: Literal["forex", "metal", "index", "crypto"]
    pip_size: float = Field(gt=0)
    contract_size: float = Field(gt=0)
    quote_currency: str = Field(min_length=3, max_length=8)
    price_decimals: int = Field(default=5, ge=0, le=10)


class CostsIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    spread_pips: float = Field(default=0, ge=0)
    commission_per_lot: float = Field(default=0, ge=0)
    slippage_pips: float = Field(default=0, ge=0)


class CandleIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    time: int = Field(ge=0)
    open: float
    high: float
    low: float
    close: float


class OrderIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1)
    side: Literal["buy", "sell"]
    kind: Literal["market", "limit", "stop"]
    size: float = Field(gt=0)
    price: float | None = None
    sl: float | None = None
    tp: float | None = None


class ActionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    at: int = Field(ge=0)
    type: Literal["place", "cancel", "close"]
    order: OrderIn | None = None
    order_id: str | None = None


class ExpectedFill(BaseModel):
    model_config = ConfigDict(extra="forbid")
    order_id: str
    time: int
    price: float
    reason: str


class ExpectedTrade(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    side: Literal["buy", "sell"]
    entry_price: float
    exit_price: float
    pips: float
    r_multiple: float | None
    pnl: float
    pnl_currency: str
    exit_reason: str


class ExpectedStats(BaseModel):
    model_config = ConfigDict(extra="forbid")
    net_profit: float
    trade_count: int
    wins: int


class Expected(BaseModel):
    model_config = ConfigDict(extra="forbid")
    fills: list[ExpectedFill]
    trades: list[ExpectedTrade]
    warnings: list[str] = []
    stats: ExpectedStats | None = None
    skip_counts: dict[str, int] = Field(default_factory=dict)


class ScenarioCase(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str
    instrument: InstrumentIn
    costs: CostsIn = CostsIn()
    account_currency: str = "USD"
    initial_balance: float = 10_000
    conversion_rate: float | None = None
    close_at_end: Literal["end of data", "session end"] | None = None
    candles: list[CandleIn] = Field(min_length=1)
    actions: list[ActionIn] = []
    expected: Expected
    seed: int | None = None


class ScenarioFile(BaseModel):
    """One file is either a single case or a list of cases under `cases`."""

    model_config = ConfigDict(extra="forbid")
    id: str
    description: str
    tolerance: Tolerance = Tolerance()
    seed: int | None = None
    instrument: InstrumentIn | None = None
    costs: CostsIn | None = None
    account_currency: str = "USD"
    initial_balance: float = 10_000
    conversion_rate: float | None = None
    close_at_end: Literal["end of data", "session end"] | None = None
    candles: list[CandleIn] | None = None
    actions: list[ActionIn] | None = None
    expected: Expected | None = None
    cases: list[ScenarioCase] | None = None
    mode: Literal["orders", "strategy"] = "orders"
    engines: list[str] = Field(default_factory=lambda: ["python", "typescript"])
    definition: dict | None = None

    def resolved_cases(self) -> list[ScenarioCase]:
        if self.cases:
            return self.cases
        if self.instrument is None or self.candles is None or self.expected is None:
            raise ValueError(f"scenario {self.id} needs either cases or a top-level instrument, candles and expected")
        return [
            ScenarioCase(
                name=self.id,
                instrument=self.instrument,
                costs=self.costs or CostsIn(),
                account_currency=self.account_currency,
                initial_balance=self.initial_balance,
                conversion_rate=self.conversion_rate,
                close_at_end=self.close_at_end,
                candles=self.candles,
                actions=self.actions or [],
                expected=self.expected,
                seed=self.seed,
            )
        ]


def load_scenario(path: Path) -> ScenarioFile:
    return ScenarioFile.model_validate(json.loads(path.read_text(encoding="utf-8")))


def scenario_dir() -> Path:
    return Path(__file__).resolve().parents[3] / "fixtures" / "backtesting" / "scenarios"


def load_scenarios() -> list[ScenarioFile]:
    return [load_scenario(path) for path in sorted(scenario_dir().glob("*.json"))]
