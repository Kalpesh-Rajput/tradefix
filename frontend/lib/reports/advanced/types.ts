import type { TradeFixScoreResult } from "@/lib/types";

export type AdvancedStatus = "ok" | "insufficient";
export type Evidence = "strong" | "moderate" | "weak" | "insufficient";
export type AdvancedPnlMode = "net" | "gross";

export interface BucketStats {
  trades: number;
  wins: number;
  losses: number;
  breakeven: number;
  win_rate: number | null;
  net_pnl: number;
  avg_pnl: number | null;
  gross_profit: number;
  gross_loss: number;
  profit_factor: number | null;
  avg_win: number | null;
  avg_loss: number | null;
  payoff: number | null;
}

export interface KeyedStats extends BucketStats {
  key: string;
  label: string;
}

export interface AdvancedMeta {
  account_id: string;
  currency: string;
  timezone: string;
  pnl_mode: AdvancedPnlMode;
  date_from: string | null;
  date_to: string | null;
  period_label: string;
  previous_from: string | null;
  previous_to: string | null;
  filters: Record<string, string[]>;
  trade_count: number;
  open_trades_excluded: number;
  generated_at: string;
  pnl_note: string;
  equity_note: string;
  scope_note: string;
}

export interface DataQuality {
  skipped_invalid_pnl: number;
  missing_risk: number;
  missing_close_time: number;
  unrated: number;
  possible_duplicates: number;
  duplicate_note: string;
}

export interface AdvancedSummary extends BucketStats {
  expectancy: number | null;
  max_drawdown: number;
  max_drawdown_pct: number;
  recovery_factor: number | null;
  largest_win: number | null;
  largest_loss: number | null;
  total_fees: number;
  trading_days: number;
  green_days: number;
  red_days: number;
  best_day: number | null;
  worst_day: number | null;
  avg_r: number | null;
  r_coverage: number | null;
  avg_execution: number | null;
}

export interface Delta {
  previous: number | null;
  delta: number | null;
}

export interface EquityPoint {
  index: number;
  date: string;
  trade_id: string;
  pnl: number;
  cumulative_pnl: number;
  equity: number;
  drawdown: number;
  drawdown_pct: number | null;
}

export interface DrawdownEpisode {
  start_date: string | null;
  trough_date: string | null;
  recovery_date: string | null;
  depth: number;
  depth_pct: number | null;
  trades_to_trough: number;
  trades_to_recover: number | null;
  days: number | null;
  recovered: boolean;
}

export interface MonthRow {
  year: number;
  month: number;
  key: string;
  label: string;
  trades: number;
  net_pnl: number;
  win_rate: number | null;
  return_pct: number | null;
  equity_start: number;
}

export interface DailyDistribution {
  status: AdvancedStatus;
  reason: string | null;
  sample_size: number;
  bins: { start: number; end: number; days: number; green: number; red: number }[];
  mean?: number | null;
  median?: number | null;
  stdev?: number | null;
  green_days?: number | null;
  red_days?: number | null;
  flat_days?: number | null;
  avg_green?: number | null;
  avg_red?: number | null;
}

export interface RStats {
  status: AdvancedStatus;
  reason: string | null;
  sample_size: number;
  coverage_pct: number;
  distribution: { bucket: string; count: number }[];
  mean?: number | null;
  median?: number | null;
  stdev?: number | null;
  best?: number | null;
  worst?: number | null;
  share_ge_1r?: number | null;
  share_le_minus_1r?: number | null;
}

export interface Sqn {
  status: AdvancedStatus;
  reason: string | null;
  sample_size: number;
  value?: number | null;
  band?: string | null;
  formula?: string | null;
}

export interface Kelly {
  status: AdvancedStatus;
  reason: string | null;
  sample_size: number;
  note: string;
  value_pct?: number | null;
  range_low_pct?: number | null;
  range_high_pct?: number | null;
  win_probability?: number | null;
  payoff?: number | null;
  positive_edge?: boolean | null;
  stability?: "stable" | "unstable" | null;
}

export interface PlanOutcome {
  status: AdvancedStatus;
  reason: string | null;
  sample_size: number;
  note: string;
  avg_planned_r?: number | null;
  avg_realized_r?: number | null;
  target_reached_pct?: number | null;
  full_stop_pct?: number | null;
  avg_capture_pct?: number | null;
}

export interface Streaks {
  max_win_streak: number;
  max_loss_streak: number;
  avg_win_streak: number | null;
  avg_loss_streak: number | null;
  current_type: string;
  current_length: number;
  distribution: { length: number; win_streaks: number; loss_streaks: number }[];
}

export interface McBand {
  step: number;
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
  historical: number;
}

export interface MonteCarlo {
  status: AdvancedStatus;
  reason: string | null;
  sample_size: number;
  method?: string | null;
  paths?: number | null;
  horizon?: number | null;
  horizon_capped?: boolean | null;
  seed?: number | null;
  starting_balance?: number | null;
  bands: McBand[];
  final_pnl?: Record<string, number> | null;
  max_drawdown?: Record<string, number> | null;
  prob_loss?: number | null;
  drawdown_thresholds: { threshold_pct: number; threshold_amount: number; probability: number }[];
  historical_final_pnl?: number | null;
  historical_max_drawdown?: number | null;
  assumptions: string[];
  cached?: boolean | null;
}

export interface TimeCell {
  key: string;
  trades: number;
  win_rate: number | null;
  net_pnl: number;
  avg_pnl: number | null;
}

export interface Timing {
  timezone_basis: string;
  weekday_hour: (TimeCell & { weekday: number; hour: number })[];
  weekdays: (TimeCell & { label: string; weekday: number })[];
  hours: (TimeCell & { label: string; hour: number })[];
  sessions: (TimeCell & { label: string })[];
  hold_buckets: (TimeCell & { label: string })[];
  hold_scatter: { id: string; seconds: number; pnl: number; symbol: string }[];
  hold_scatter_total: number;
  missing_hold: number;
}

export interface LeaderRow extends KeyedStats {
  avg_r: number | null;
  r_trades: number;
  win_rate_last_30d: number | null;
  win_rate_prior_30d: number | null;
  trades_last_30d: number;
  spark: number[];
}

export interface SymbolRow extends KeyedStats {
  share_of_profit_pct: number | null;
  cumulative_share_pct: number | null;
}

export interface StrategyBlock {
  strategies: LeaderRow[];
  setups: LeaderRow[];
  setup_overlap: { tagged_trades: number; multi_tagged_trades: number; note: string };
  sides: KeyedStats[];
  asset_types: KeyedStats[];
  symbols: SymbolRow[];
  symbols_other: { symbols: number; trades: number; net_pnl: number } | null;
  symbol_count: number;
  profitable_symbols: number;
}

export interface GroupCompare {
  n_with: number;
  n_without: number;
  avg_with: number | null;
  avg_without: number | null;
  diff: number | null;
  t_stat: number | null;
  evidence: Evidence;
}

export interface ComparisonRow extends GroupCompare {
  key: string;
  label: string;
  trades: number;
  win_rate: number | null;
  net_pnl: number;
  avg_pnl: number | null;
  win_rate_without: number | null;
}

export interface LabelComparison {
  rows: ComparisonRow[];
  labelled_trades: number;
  unlabelled_trades: number;
  multi_label_trades: number;
  overlap_pct: number;
  note: string;
  overlap_note: string;
}

export interface Psychology {
  emotions: LabelComparison;
  moods: LabelComparison;
  mood_scores: KeyedStats[];
  after_outcome: KeyedStats[];
  after_rule: string;
  quick_reentry: {
    window_minutes: number;
    quick: BucketStats;
    patient: BucketStats;
    comparison: GroupCompare;
    rule: string;
  };
  trade_number: KeyedStats[];
}

export interface Discipline {
  rules: LabelComparison;
  clean_vs_broken: { clean: BucketStats; broken: BucketStats; clean_rate: number | null };
  compliance: KeyedStats[];
  compliance_rated: number;
  execution: KeyedStats[];
  score_dimensions: {
    key: string;
    label: string;
    avg: number | null;
    rated_trades: number;
    previous_avg: number | null;
    previous_rated_trades: number;
  }[];
  checkins: {
    key: string;
    label: string;
    days: number;
    trades: number;
    avg_day_pnl: number | null;
    net_pnl: number;
    green_day_pct: number | null;
  }[];
  process_by_month: {
    key: string;
    trades: number;
    net_pnl: number;
    avg_execution: number;
    avg_health: number | null;
    rule_break_pct: number;
  }[];
  execution_note: string;
}

export interface DrillRef {
  dimension: string;
  key: string;
}

export interface Finding {
  id: string;
  category: string;
  dimension: string;
  key: string;
  tone: "positive" | "negative";
  headline: string;
  explanation: string;
  metric_label: string;
  value: number | null;
  baseline: number | null;
  diff: number | null;
  win_rate: number | null;
  win_rate_baseline: number | null;
  sample_size: number;
  comparison_size: number;
  net_pnl: number;
  evidence: Evidence;
  t_stat: number | null;
  magnitude: number;
  period: string;
  qualification: string | null;
  drill: DrillRef;
}

export interface AdvancedAnalytics {
  meta: AdvancedMeta;
  data_quality: DataQuality;
  summary: AdvancedSummary;
  comparison: Record<string, Delta> | null;
  score: TradeFixScoreResult;
  performance: {
    equity: {
      starting_balance: number;
      basis: "realized";
      points: EquityPoint[];
      total_points: number;
      episodes: DrawdownEpisode[];
    };
    monthly: MonthRow[];
    daily: DailyDistribution;
  };
  risk: {
    r: RStats;
    sqn: Sqn;
    kelly: Kelly;
    plan: PlanOutcome;
    streaks: Streaks;
    monte_carlo: MonteCarlo;
  };
  timing: Timing;
  strategy: StrategyBlock;
  psychology: Psychology;
  discipline: Discipline;
  insights: {
    items: Finding[];
    candidates_evaluated: number;
    ranking_method: string;
    status: AdvancedStatus;
    reason: string | null;
  };
}

export interface DrillRow {
  id: string;
  symbol: string;
  side: string;
  opened_at: string;
  closed_at: string | null;
  pnl: number;
  net_pnl: number;
  fees: number;
  r: number | null;
  strategy: string | null;
  setups: string[];
  emotions: string[];
  rules: string[];
  possible_duplicate: boolean;
}

export interface DrilldownResult {
  dimension: string;
  key: string;
  pnl_mode: AdvancedPnlMode;
  total: number;
  returned: number;
  truncated: boolean;
  summary: BucketStats;
  rows: DrillRow[];
}
