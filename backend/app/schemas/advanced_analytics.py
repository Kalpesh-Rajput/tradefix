from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from app.schemas.analytics import TradeFixScoreResult

Status = Literal["ok", "insufficient"]
Evidence = Literal["strong", "moderate", "weak", "insufficient"]


class BucketStats(BaseModel):
    trades: int
    wins: int
    losses: int
    breakeven: int
    win_rate: float | None
    net_pnl: float
    avg_pnl: float | None
    gross_profit: float
    gross_loss: float
    profit_factor: float | None
    avg_win: float | None
    avg_loss: float | None
    payoff: float | None


class KeyedStats(BucketStats):
    key: str
    label: str


class Meta(BaseModel):
    account_id: str
    currency: str
    timezone: str
    pnl_mode: Literal["net", "gross"]
    date_from: str | None
    date_to: str | None
    period_label: str
    previous_from: str | None
    previous_to: str | None
    filters: dict[str, list[str]]
    trade_count: int
    open_trades_excluded: int
    generated_at: str
    pnl_note: str
    equity_note: str
    scope_note: str


class DataQuality(BaseModel):
    skipped_invalid_pnl: int
    missing_risk: int
    missing_close_time: int
    unrated: int
    possible_duplicates: int
    duplicate_note: str


class Summary(BucketStats):
    expectancy: float | None
    max_drawdown: float
    max_drawdown_pct: float
    recovery_factor: float | None
    largest_win: float | None
    largest_loss: float | None
    total_fees: float
    trading_days: int
    green_days: int
    red_days: int
    best_day: float | None
    worst_day: float | None
    avg_r: float | None
    r_coverage: float | None
    avg_execution: float | None


class Delta(BaseModel):
    previous: float | None
    delta: float | None


class EquityPoint(BaseModel):
    index: int
    date: str
    trade_id: str
    pnl: float
    cumulative_pnl: float
    equity: float
    drawdown: float
    drawdown_pct: float | None


class DrawdownEpisode(BaseModel):
    start_date: str | None
    trough_date: str | None
    recovery_date: str | None
    depth: float
    depth_pct: float | None
    trades_to_trough: int
    trades_to_recover: int | None
    days: int | None
    recovered: bool


class Equity(BaseModel):
    starting_balance: float
    basis: Literal["realized"]
    points: list[EquityPoint]
    total_points: int
    episodes: list[DrawdownEpisode]


class MonthRow(BaseModel):
    year: int
    month: int
    key: str
    label: str
    trades: int
    net_pnl: float
    win_rate: float | None
    return_pct: float | None
    equity_start: float


class DailyBin(BaseModel):
    start: float
    end: float
    days: int
    green: int
    red: int


class DailyDistribution(BaseModel):
    status: Status
    reason: str | None
    sample_size: int
    bins: list[DailyBin]
    mean: float | None = None
    median: float | None = None
    stdev: float | None = None
    green_days: int | None = None
    red_days: int | None = None
    flat_days: int | None = None
    avg_green: float | None = None
    avg_red: float | None = None


class Performance(BaseModel):
    equity: Equity
    monthly: list[MonthRow]
    daily: DailyDistribution


class RBucket(BaseModel):
    bucket: str
    count: int


class RStats(BaseModel):
    status: Status
    reason: str | None
    sample_size: int
    coverage_pct: float
    distribution: list[RBucket]
    mean: float | None = None
    median: float | None = None
    stdev: float | None = None
    best: float | None = None
    worst: float | None = None
    share_ge_1r: float | None = None
    share_le_minus_1r: float | None = None


class Sqn(BaseModel):
    status: Status
    reason: str | None
    sample_size: int
    value: float | None = None
    band: str | None = None
    formula: str | None = None


class Kelly(BaseModel):
    status: Status
    reason: str | None
    sample_size: int
    note: str
    value_pct: float | None = None
    range_low_pct: float | None = None
    range_high_pct: float | None = None
    win_probability: float | None = None
    payoff: float | None = None
    positive_edge: bool | None = None
    stability: Literal["stable", "unstable"] | None = None


class PlanOutcome(BaseModel):
    status: Status
    reason: str | None
    sample_size: int
    note: str
    avg_planned_r: float | None = None
    avg_realized_r: float | None = None
    target_reached_pct: float | None = None
    full_stop_pct: float | None = None
    avg_capture_pct: float | None = None


class StreakLength(BaseModel):
    length: int
    win_streaks: int
    loss_streaks: int


class Streaks(BaseModel):
    max_win_streak: int
    max_loss_streak: int
    avg_win_streak: float | None
    avg_loss_streak: float | None
    current_type: str
    current_length: int
    distribution: list[StreakLength]


class McBand(BaseModel):
    step: int
    p5: float
    p25: float
    p50: float
    p75: float
    p95: float
    historical: float


class McThreshold(BaseModel):
    threshold_pct: int
    threshold_amount: float
    probability: float


class MonteCarlo(BaseModel):
    status: Status
    reason: str | None
    sample_size: int
    method: str | None = None
    paths: int | None = None
    horizon: int | None = None
    horizon_capped: bool | None = None
    seed: int | None = None
    starting_balance: float | None = None
    bands: list[McBand] = []
    final_pnl: dict[str, float] | None = None
    max_drawdown: dict[str, float] | None = None
    prob_loss: float | None = None
    drawdown_thresholds: list[McThreshold] = []
    historical_final_pnl: float | None = None
    historical_max_drawdown: float | None = None
    assumptions: list[str] = []
    cached: bool | None = None


class Risk(BaseModel):
    r: RStats
    sqn: Sqn
    kelly: Kelly
    plan: PlanOutcome
    streaks: Streaks
    monte_carlo: MonteCarlo


class TimeCell(BaseModel):
    key: str
    trades: int
    win_rate: float | None
    net_pnl: float
    avg_pnl: float | None


class HeatCell(TimeCell):
    weekday: int
    hour: int


class WeekdayCell(TimeCell):
    label: str
    weekday: int


class HourCell(TimeCell):
    label: str
    hour: int


class LabeledCell(TimeCell):
    label: str


class ScatterPoint(BaseModel):
    id: str
    seconds: int
    pnl: float
    symbol: str


class Timing(BaseModel):
    timezone_basis: str
    weekday_hour: list[HeatCell]
    weekdays: list[WeekdayCell]
    hours: list[HourCell]
    sessions: list[LabeledCell]
    hold_buckets: list[LabeledCell]
    hold_scatter: list[ScatterPoint]
    hold_scatter_total: int
    missing_hold: int


class LeaderRow(KeyedStats):
    avg_r: float | None
    r_trades: int
    win_rate_last_30d: float | None
    win_rate_prior_30d: float | None
    trades_last_30d: int
    spark: list[float]


class SymbolRow(KeyedStats):
    share_of_profit_pct: float | None
    cumulative_share_pct: float | None


class SymbolsOther(BaseModel):
    symbols: int
    trades: int
    net_pnl: float


class SetupOverlap(BaseModel):
    tagged_trades: int
    multi_tagged_trades: int
    note: str


class Strategy(BaseModel):
    strategies: list[LeaderRow]
    setups: list[LeaderRow]
    setup_overlap: SetupOverlap
    sides: list[KeyedStats]
    asset_types: list[KeyedStats]
    symbols: list[SymbolRow]
    symbols_other: SymbolsOther | None
    symbol_count: int
    profitable_symbols: int


class ComparisonRow(BaseModel):
    key: str
    label: str
    trades: int
    win_rate: float | None
    net_pnl: float
    avg_pnl: float | None
    win_rate_without: float | None
    n_with: int
    n_without: int
    avg_with: float | None
    avg_without: float | None
    diff: float | None
    t_stat: float | None
    evidence: Evidence


class LabelComparison(BaseModel):
    rows: list[ComparisonRow]
    labelled_trades: int
    unlabelled_trades: int
    multi_label_trades: int
    overlap_pct: float
    note: str
    overlap_note: str


class GroupCompare(BaseModel):
    n_with: int
    n_without: int
    avg_with: float | None
    avg_without: float | None
    diff: float | None
    t_stat: float | None
    evidence: Evidence


class QuickReentry(BaseModel):
    window_minutes: int
    quick: BucketStats
    patient: BucketStats
    comparison: GroupCompare
    rule: str


class Psychology(BaseModel):
    emotions: LabelComparison
    moods: LabelComparison
    mood_scores: list[KeyedStats]
    after_outcome: list[KeyedStats]
    after_rule: str
    quick_reentry: QuickReentry
    trade_number: list[KeyedStats]


class CleanVsBroken(BaseModel):
    clean: BucketStats
    broken: BucketStats
    clean_rate: float | None


class ScoreDimension(BaseModel):
    key: str
    label: str
    avg: float | None
    rated_trades: int
    previous_avg: float | None
    previous_rated_trades: int


class CheckinRow(BaseModel):
    key: str
    label: str
    days: int
    trades: int
    avg_day_pnl: float | None
    net_pnl: float
    green_day_pct: float | None


class ProcessMonth(BaseModel):
    key: str
    trades: int
    net_pnl: float
    avg_execution: float
    avg_health: float | None
    rule_break_pct: float


class Discipline(BaseModel):
    rules: LabelComparison
    clean_vs_broken: CleanVsBroken
    compliance: list[KeyedStats]
    compliance_rated: int
    execution: list[KeyedStats]
    score_dimensions: list[ScoreDimension]
    checkins: list[CheckinRow]
    process_by_month: list[ProcessMonth]
    execution_note: str


class DrillRef(BaseModel):
    dimension: str
    key: str


class Finding(BaseModel):
    id: str
    category: str
    dimension: str
    key: str
    tone: Literal["positive", "negative"]
    headline: str
    explanation: str
    metric_label: str
    value: float | None
    baseline: float | None
    diff: float | None
    win_rate: float | None
    win_rate_baseline: float | None
    sample_size: int
    comparison_size: int
    net_pnl: float
    evidence: Evidence
    t_stat: float | None
    magnitude: float
    period: str
    qualification: str | None
    drill: DrillRef


class Insights(BaseModel):
    items: list[Finding]
    candidates_evaluated: int
    ranking_method: str
    status: Status
    reason: str | None


class AdvancedAnalyticsResponse(BaseModel):
    meta: Meta
    data_quality: DataQuality
    summary: Summary
    comparison: dict[str, Delta] | None
    score: TradeFixScoreResult
    performance: Performance
    risk: Risk
    timing: Timing
    strategy: Strategy
    psychology: Psychology
    discipline: Discipline
    insights: Insights


class DrillRow(BaseModel):
    id: str
    symbol: str
    side: str
    opened_at: str
    closed_at: str | None
    pnl: float
    net_pnl: float
    fees: float
    r: float | None
    strategy: str | None
    setups: list[str]
    emotions: list[str]
    rules: list[str]
    possible_duplicate: bool


class DrilldownResponse(BaseModel):
    dimension: str
    key: str
    pnl_mode: Literal["net", "gross"]
    total: int
    returned: int
    truncated: bool
    summary: BucketStats
    rows: list[DrillRow]
