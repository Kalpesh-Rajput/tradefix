from pydantic import BaseModel


class OverviewStats(BaseModel):
    total_trades: int
    win_rate: float
    total_pnl: float
    avg_win: float
    avg_loss: float
    current_streak: int
    current_streak_type: str  # "win" | "loss" | "none"
    best_day_pnl: float
    worst_day_pnl: float


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


class MoodPnlPoint(BaseModel):
    mood_score: int
    trades: int
    avg_pnl: float
    win_rate: float


class AnalyticsResponse(BaseModel):
    overview: OverviewStats
    by_hour: list[TimeBucketStat]
    by_day_of_week: list[TimeBucketStat]
    by_setup: list[SetupStat]
    mood_vs_pnl: list[MoodPnlPoint]


class CalendarDay(BaseModel):
    date: str
    trades: int
    pnl: float
    win_rate: float


class CalendarResponse(BaseModel):
    days: list[CalendarDay]
    total_pnl: float
    total_trades: int
    win_rate: float
