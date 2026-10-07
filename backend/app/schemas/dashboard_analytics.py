from pydantic import BaseModel, Field


class PerformanceCounts(BaseModel):
    trades: int = 0
    wins: int = 0
    losses: int = 0
    breakeven: int = 0
    win_rate: float | None = None
    pnl: float | None = None
    avg_pnl: float | None = None
    profit_factor: float | None = None


class WeeklyWinRatePoint(PerformanceCounts):
    day: str
    weekday: int


class MonthPerformancePoint(PerformanceCounts):
    year: int
    month: int
    label: str
    short_label: str


class YearlyPerformance(BaseModel):
    year: int
    months: list[MonthPerformancePoint]
    total: PerformanceCounts


class HourlyPerformancePoint(PerformanceCounts):
    hour: int
    label: str


class HeatmapDay(PerformanceCounts):
    date: str
    in_range: bool = True


class DurationPnlPoint(BaseModel):
    seconds: int
    pnl: float


class ActivityHeatmap(BaseModel):
    start: str
    end: str
    range_start: str
    range_end: str
    days: list[HeatmapDay] = Field(default_factory=list)


class StrategyPerformanceRow(PerformanceCounts):
    id: str
    name: str


class DisciplineOption(BaseModel):
    id: str
    label: str


class DisciplineStats(BaseModel):
    trades: int = 0
    followed: int = 0
    violated: int = 0
    discipline_rate: float | None = None
    most_violated_rule: str | None = None
    most_violated_count: int = 0


class RuleDiscipline(BaseModel):
    options: list[DisciplineOption] = Field(default_factory=list)
    by_strategy: dict[str, DisciplineStats] = Field(default_factory=dict)


class SymbolPerformanceRow(PerformanceCounts):
    symbol: str


class NamedPerformance(PerformanceCounts):
    name: str


class MistakeInsight(PerformanceCounts):
    name: str
    occurrences: int = 0


class TradingInsights(BaseModel):
    best_strategy: NamedPerformance | None = None
    best_session: NamedPerformance | None = None
    best_timeframe: NamedPerformance | None = None
    most_common_mistake: MistakeInsight | None = None
    best_entry: NamedPerformance | None = None
    best_exit: NamedPerformance | None = None
    sides: list[NamedPerformance] = Field(default_factory=list)
    trade_types: list[NamedPerformance] = Field(default_factory=list)
    moods: list[NamedPerformance] = Field(default_factory=list)
    went_well: list[NamedPerformance] = Field(default_factory=list)
    sessions: list[NamedPerformance] = Field(default_factory=list)
    timeframes: list[NamedPerformance] = Field(default_factory=list)
    entries: list[NamedPerformance] = Field(default_factory=list)
    exits: list[NamedPerformance] = Field(default_factory=list)


class DashboardPerformance(BaseModel):
    has_trades: bool = False
    timezone: str = "UTC"
    weekly_win_rate: list[WeeklyWinRatePoint] = Field(default_factory=list)
    yearly: YearlyPerformance
    hourly: list[HourlyPerformancePoint] = Field(default_factory=list)
    monthly_profit: list[MonthPerformancePoint] = Field(default_factory=list)
    heatmap: ActivityHeatmap
    duration_pnl: list[DurationPnlPoint] = Field(default_factory=list)
    strategies: list[StrategyPerformanceRow] = Field(default_factory=list)
    rule_discipline: RuleDiscipline = Field(default_factory=RuleDiscipline)
    symbols: list[SymbolPerformanceRow] = Field(default_factory=list)
    insights: TradingInsights = Field(default_factory=TradingInsights)
