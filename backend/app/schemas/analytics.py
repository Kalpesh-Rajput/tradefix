from datetime import datetime
import uuid

from pydantic import BaseModel, Field


class OverviewStats(BaseModel):
    total_trades: int
    win_rate: float
    total_pnl: float
    avg_win: float
    avg_loss: float
    avg_trade: float = 0.0
    profit_factor: float = 0.0
    expectancy: float = 0.0
    largest_win: float = 0.0
    largest_loss: float = 0.0
    total_fees: float = 0.0
    trading_days: int = 0
    current_streak: int
    current_streak_type: str
    best_day_pnl: float
    worst_day_pnl: float
    max_drawdown: float = 0.0
    max_drawdown_pct: float = 0.0
    avg_execution_score: float | None = None
    avg_r_multiple: float | None = None


class TimeBucketStat(BaseModel):
    bucket: str
    trades: int
    win_rate: float
    pnl: float


class SetupStat(BaseModel):
    setup_tag: str
    trades: int
    win_rate: float
    pnl: float
    win_rate_last_30d: float
    win_rate_prior_30d: float


class TagExpectancy(BaseModel):
    tag: str
    tag_type: str = "setup"
    trades: int
    win_rate: float
    pnl: float
    expectancy: float
    avg_r: float | None = None


class MoodPnlPoint(BaseModel):
    mood_score: int
    trades: int
    avg_pnl: float
    win_rate: float


class EquityPoint(BaseModel):
    date: str
    value: float
    symbol: str | None = None


class RBucket(BaseModel):
    bucket: str
    count: int


class EdgeFinder(BaseModel):
    best_day: TimeBucketStat | None = None
    worst_day: TimeBucketStat | None = None
    best_hour: TimeBucketStat | None = None
    worst_symbol: TimeBucketStat | None = None
    best_setup: TagExpectancy | None = None
    worst_emotion: TagExpectancy | None = None
    best_rr: dict | None = None


class MonthScore(BaseModel):
    month: str
    trades: int
    execution: float | None = None
    health: float | None = None
    pnl: float = 0.0


class AnalyticsResponse(BaseModel):
    overview: OverviewStats
    by_hour: list[TimeBucketStat]
    by_day_of_week: list[TimeBucketStat]
    by_setup: list[SetupStat]
    by_symbol: list[TimeBucketStat] = []
    by_session: list[TimeBucketStat] = []
    mood_vs_pnl: list[MoodPnlPoint]
    equity_curve: list[EquityPoint] = []
    r_distribution: list[RBucket] = []
    expectancy_by_tag: list[TagExpectancy] = []
    expectancy_by_emotion: list[TagExpectancy] = []
    expectancy_truncated: bool = False
    expectancy_total_tags: int = 0
    edge_finder: EdgeFinder | None = None
    performance_timeline: list[MonthScore] = []
    plan: str = "free"


class CalendarDay(BaseModel):
    date: str
    trades: int
    pnl: float
    win_rate: float
    gross_pnl: float = 0.0
    volume: float = 0.0
    winners: int = 0
    losers: int = 0
    profit_factor: float = 0.0
    commissions: float = 0.0
    curve: list[float] = Field(default_factory=list)


class CalendarResponse(BaseModel):
    days: list[CalendarDay]
    total_pnl: float
    total_trades: int
    win_rate: float
