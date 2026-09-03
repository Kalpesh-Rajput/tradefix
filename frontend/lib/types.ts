export type AssetType = "stock" | "option" | "future" | "forex" | "crypto";
export type TradeSide = "long" | "short";
export type TradeStatus = "open" | "closed";
export type PnlDisplayMode = "net" | "gross";

export interface Account {
  id: string;
  name: string;
  description?: string | null;
  base_currency: string;
  initial_balance: number;
  pnl_display_mode: PnlDisplayMode;
  default_fee_per_trade: number;
  is_default: boolean;
  trade_count: number;
}

export interface AccountInput {
  name: string;
  description?: string | null;
  base_currency?: string;
  initial_balance?: number;
  pnl_display_mode?: PnlDisplayMode;
  default_fee_per_trade?: number;
  is_default?: boolean;
}

export interface AccountUpdateInput {
  name?: string;
  description?: string | null;
  base_currency?: string;
  initial_balance?: number;
  pnl_display_mode?: PnlDisplayMode;
  default_fee_per_trade?: number;
  is_default?: boolean;
}

export interface Trade {
  id: string;
  account_id: string;
  symbol: string;
  asset_type: AssetType;
  side: TradeSide;
  quantity: number;
  entry_price: number;
  exit_price: number | null;
  opened_at: string;
  closed_at: string | null;
  pnl: number | null;
  fees: number;
  risk_amount: number | null;
  setup_tag: string | null;
  setup_tags: string[];
  emotion_tags: string[];
  plan_compliance: number | null;
  mood: string | null;
  notes: string | null;
  rules_broken: string[];
  screenshot_urls: string[];
  voice_url: string | null;
  voice_transcript: string | null;
  score_preparation: number | null;
  score_risk: number | null;
  score_entry: number | null;
  score_exit: number | null;
  score_discipline: number | null;
  score_psychology: number | null;
  auto_flags: string[];
  execution_score: number | null;
  health_score: number | null;
  r_multiple: number | null;
  status: TradeStatus;
  created_at: string;
  account_name?: string | null;
  session?: string | null;
  trade_type?: string | null;
  option_type?: string | null;
  analysis_timeframe?: string | null;
  entry_timeframe?: string | null;
  stop_loss?: number | null;
  invested_amount?: number | null;
  entry_condition?: string | null;
  exit_condition?: string | null;
  sell_quantity?: number | null;
  total_sell_amount?: number | null;
  leverage?: number | null;
  contract_size?: number | null;
  is_favourite?: boolean;
  is_deleted?: boolean;
  is_sync?: boolean;
  is_close?: boolean;
  is_equity?: boolean;
  is_profit?: boolean | null;
  year?: number | null;
  month?: number | null;
  strategy_name?: string | null;
  strategy_id?: string | null;
  precheck_list_id?: string | null;
  extra?: Record<string, unknown>;
  remaining_quantity?: number | null;
  executions?: TradeExecution[];
}

export type ExecutionLegType = "entry" | "exit";

export interface TradeExecution {
  id: string;
  leg_type: ExecutionLegType;
  quantity: number;
  price: number;
  executed_at: string;
  fees: number;
  condition?: string | null;
  notes?: string | null;
  sort_order: number;
}

export interface TradeExecutionInput {
  id?: string;
  leg_type: ExecutionLegType;
  quantity: number;
  price: number;
  executed_at: string;
  fees?: number;
  condition?: string | null;
  notes?: string | null;
  sort_order?: number;
}

export interface TradeInput {
  symbol: string;
  asset_type: AssetType;
  side: TradeSide;
  quantity: number;
  entry_price: number;
  exit_price?: number | null;
  sell_quantity?: number | null;
  opened_at: string;
  closed_at?: string | null;
  fees?: number;
  risk_amount?: number | null;
  setup_tag?: string | null;
  setup_tags?: string[];
  emotion_tags?: string[];
  plan_compliance?: number | null;
  mood?: string | null;
  notes?: string | null;
  rules_broken?: string[];
  score_preparation?: number | null;
  score_risk?: number | null;
  score_entry?: number | null;
  score_exit?: number | null;
  score_discipline?: number | null;
  score_psychology?: number | null;
  voice_transcript?: string | null;
  status: TradeStatus;
  account_id?: string;
  session?: string | null;
  trade_type?: string | null;
  option_type?: string | null;
  analysis_timeframe?: string | null;
  entry_timeframe?: string | null;
  stop_loss?: number | null;
  entry_condition?: string | null;
  exit_condition?: string | null;
  leverage?: number | null;
  contract_size?: number | null;
  is_favourite?: boolean;
  strategy_name?: string | null;
  strategy_id?: string | null;
  precheck_list_id?: string | null;
  extra?: Record<string, unknown>;
  executions?: TradeExecutionInput[];
}

export type MasterCategory =
  | "symbol"
  | "entry_condition"
  | "exit_condition"
  | "timeframe"
  | "session"
  | "trade_type"
  | "mood"
  | "strategy";

export interface TradeMaster {
  id: string;
  category: MasterCategory;
  name: string;
  sort_order: number;
  is_builtin: boolean;
  created_at: string;
}

export interface PrecheckItem {
  id: string;
  label: string;
}

export interface PrecheckList {
  id: string;
  name: string;
  items: PrecheckItem[];
  created_at: string;
  updated_at: string;
}

export interface OverviewStats {
  total_trades: number;
  win_rate: number;
  total_pnl: number;
  avg_win: number;
  avg_loss: number;
  avg_trade: number;
  profit_factor: number;
  expectancy: number;
  largest_win: number;
  largest_loss: number;
  total_fees: number;
  trading_days: number;
  current_streak: number;
  current_streak_type: "win" | "loss" | "none";
  best_day_pnl: number;
  worst_day_pnl: number;
  max_drawdown?: number;
  max_drawdown_pct?: number;
  avg_execution_score?: number | null;
  avg_r_multiple?: number | null;
}

export interface TimeBucketStat {
  bucket: string;
  trades: number;
  win_rate: number;
  pnl: number;
}

export interface SetupStat {
  setup_tag: string;
  trades: number;
  win_rate: number;
  pnl: number;
  win_rate_last_30d: number;
  win_rate_prior_30d: number;
}

export interface TagExpectancy {
  tag: string;
  tag_type: string;
  trades: number;
  win_rate: number;
  pnl: number;
  expectancy: number;
  avg_r: number | null;
}

export interface MoodPnlPoint {
  mood_score: number;
  trades: number;
  avg_pnl: number;
  win_rate: number;
}

export interface EquityPoint {
  date: string;
  value: number;
  symbol?: string | null;
}

export interface RBucket {
  bucket: string;
  count: number;
}

export interface EdgeFinder {
  best_day: TimeBucketStat | null;
  worst_day: TimeBucketStat | null;
  best_hour: TimeBucketStat | null;
  worst_symbol: TimeBucketStat | null;
  best_setup: TagExpectancy | null;
  worst_emotion: TagExpectancy | null;
  best_rr: Record<string, unknown> | null;
}

export interface MonthScore {
  month: string;
  trades: number;
  execution: number | null;
  health: number | null;
  pnl: number;
}

export interface AnalyticsResponse {
  overview: OverviewStats;
  by_hour: TimeBucketStat[];
  by_day_of_week: TimeBucketStat[];
  by_setup: SetupStat[];
  by_symbol: TimeBucketStat[];
  by_session: TimeBucketStat[];
  mood_vs_pnl: MoodPnlPoint[];
  equity_curve: EquityPoint[];
  r_distribution: RBucket[];
  expectancy_by_tag: TagExpectancy[];
  expectancy_by_emotion: TagExpectancy[];
  expectancy_truncated: boolean;
  expectancy_total_tags: number;
  edge_finder: EdgeFinder | null;
  performance_timeline: MonthScore[];
  plan: string;
}

export interface CalendarDay {
  date: string;
  trades: number;
  pnl: number;
  win_rate: number;
  gross_pnl?: number;
  volume?: number;
  winners?: number;
  losers?: number;
  profit_factor?: number;
  commissions?: number;
  curve?: number[];
}

export interface CalendarResponse {
  days: CalendarDay[];
  total_pnl: number;
  total_trades: number;
  win_rate: number;
}

export type InsightSeverity = "info" | "warning" | "critical" | "positive";

export interface Insight {
  id: string;
  agent_name: string | null;
  type: string;
  title: string;
  body: string;
  severity: InsightSeverity;
  data: Record<string, unknown>;
  created_at: string;
  dismissed_at: string | null;
}

export interface AgentRun {
  id: string;
  agent_name: string;
  status: "success" | "skipped" | "failed";
  message: string | null;
  insight_id: string | null;
  run_at: string;
}

export interface WatchlistItem {
  id: string;
  symbol: string;
  notes: string | null;
  created_at: string;
}

export interface MoodCheckin {
  id: string;
  date: string;
  mood_score: number;
  notes: string | null;
  created_at: string;
}

export type DayMood = "good" | "mixed" | "tough";

export interface DayPnlSummary {
  date: string;
  trade_count: number;
  gross_pnl: number;
  fees: number;
  net_pnl: number;
}

export interface DailyRecap {
  id: string;
  account_id: string;
  date: string;
  day_mood: DayMood | null;
  work_on: string[];
  best_decision: string | null;
  reflection: string | null;
  pnl_override: boolean;
  gross_pnl: number | null;
  fees: number | null;
  net_pnl: number | null;
  screenshot_urls: string[];
  created_at: string;
  updated_at: string;
  computed_gross_pnl: number;
  computed_fees: number;
  computed_net_pnl: number;
  trade_count: number;
  display_gross_pnl: number;
  display_fees: number;
  display_net_pnl: number;
  recap_number: number;
}

export interface DailyRecapInput {
  account_id: string;
  date: string;
  day_mood?: DayMood | null;
  work_on?: string[];
  best_decision?: string | null;
  reflection?: string | null;
  pnl_override?: boolean;
  gross_pnl?: number | null;
  fees?: number | null;
  net_pnl?: number | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  username?: string | null;
  bio?: string | null;
  location?: string | null;
  website_url?: string | null;
  twitter_url?: string | null;
  linkedin_url?: string | null;
  avatar_url?: string | null;
  public_profile?: boolean;
  show_financial_metrics?: boolean;
  show_latest_trades?: boolean;
  show_pnl_chart?: boolean;
  timezone?: string;
  language?: string;
  date_format?: string;
  save_filters?: boolean;
  journal_template?: string | null;
  default_symbol?: string | null;
  default_quantity?: number | null;
  default_fee?: number | null;
  default_forex_leverage?: number | null;
  default_strategies?: string[];
  custom_strategies?: string[];
  strategy_order?: string[];
  custom_mistakes?: string[];
  mistake_order?: string[];
  weekly_goal?: number | null;
  monthly_goal?: number | null;
  yearly_goal?: number | null;
  target_trades?: number | null;
  theme?: string;
  accent_color?: string;
  plan?: string;
  role?: string;
  custom_emotion_tags?: string[];
  emotion_tag_order?: string[];
  onboarding_step?: number;
  trading_experience?: string | null;
  capital_sources?: string[];
  primary_broker?: string | null;
  markets_traded?: string[];
  onboarding_goals?: string[];
  referral_source?: string | null;
  referral_detail?: string | null;
  onboarding_completed_at?: string | null;
}

export interface OnboardingUpdateInput {
  onboarding_step?: number;
  trading_experience?: string | null;
  capital_sources?: string[];
  primary_broker?: string | null;
  markets_traded?: string[];
  onboarding_goals?: string[];
  referral_source?: string | null;
  referral_detail?: string | null;
}

export interface UserUpdateInput {
  name?: string;
  username?: string | null;
  bio?: string | null;
  location?: string | null;
  website_url?: string | null;
  twitter_url?: string | null;
  linkedin_url?: string | null;
  public_profile?: boolean;
  show_financial_metrics?: boolean;
  show_latest_trades?: boolean;
  show_pnl_chart?: boolean;
  timezone?: string;
  language?: string;
  date_format?: string;
  save_filters?: boolean;
  journal_template?: string | null;
  default_symbol?: string | null;
  default_quantity?: number | null;
  default_fee?: number | null;
  default_forex_leverage?: number | null;
  default_strategies?: string[];
  custom_strategies?: string[];
  strategy_order?: string[];
  custom_mistakes?: string[];
  mistake_order?: string[];
  custom_emotion_tags?: string[];
  emotion_tag_order?: string[];
  weekly_goal?: number | null;
  monthly_goal?: number | null;
  yearly_goal?: number | null;
  target_trades?: number | null;
  theme?: string;
  accent_color?: string;
  plan?: string;
}

export type CheckinFollowed = "yes" | "partial" | "no";

export interface DailyCheckin {
  id: string;
  date: string;
  account_id: string | null;
  max_loss: number | null;
  max_trades: number | null;
  focus_setup: string | null;
  goal_note: string | null;
  followed: CheckinFollowed | null;
  evening_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyCheckinInput {
  date: string;
  account_id?: string | null;
  max_loss?: number | null;
  max_trades?: number | null;
  focus_setup?: string | null;
  goal_note?: string | null;
  followed?: CheckinFollowed | null;
  evening_note?: string | null;
}

export interface MilestoneItem {
  id: string;
  label: string;
  description: string;
  unlocked: boolean;
  progress: number;
  target: number;
}

export interface MilestonesResponse {
  items: MilestoneItem[];
  unlocked_count: number;
}

export interface PropProfile {
  id: string;
  max_daily_loss_pct: number;
  max_overall_drawdown_pct: number;
  consistency_rule_pct: number | null;
  min_trading_days: number;
}

export interface PropSettings {
  id: string;
  account_id: string;
  profile: string;
  max_daily_loss_pct: number;
  max_overall_drawdown_pct: number;
  consistency_rule_pct: number | null;
  min_trading_days: number | null;
  warn_threshold_pct: number;
  danger_threshold_pct: number;
  enabled: boolean;
}

export interface PropSettingsInput {
  account_id: string;
  profile: string;
  max_daily_loss_pct?: number | null;
  max_overall_drawdown_pct?: number | null;
  consistency_rule_pct?: number | null;
  min_trading_days?: number | null;
  warn_threshold_pct?: number;
  danger_threshold_pct?: number;
  enabled?: boolean;
}

export type PropRiskState = "ok" | "warn" | "danger";

export interface PropDistance {
  enabled: boolean;
  equity: number;
  starting_balance: number;
  daily_loss: number;
  daily_loss_pct: number;
  daily_limit_pct: number | null;
  daily_used_pct: number;
  overall_drawdown: number;
  overall_drawdown_pct: number;
  overall_limit_pct: number | null;
  overall_used_pct: number;
  daily_state: PropRiskState;
  overall_state: PropRiskState;
  profile: string | null;
  warn_threshold_pct?: number;
  danger_threshold_pct?: number;
}

export interface CoachStatus {
  plan: string;
  trades: number;
  required: number;
  eligible: boolean;
  locked_reason: "upgrade" | "need_trades" | null;
}

export interface CoachAskResponse {
  answer: string;
  actions: string[];
  locked: boolean;
  progress: number;
  required: number;
}

export interface CoachWeekly {
  insight: string;
  edge_finder: EdgeFinder | null;
  timeline: MonthScore[];
}

export interface MentorAccess {
  id: string;
  trader_id: string;
  coach_id: string;
  trader_email?: string | null;
  coach_email?: string | null;
  trader_name?: string | null;
  status: string;
}

export interface TradeComment {
  id: string;
  trade_id: string;
  author_id: string;
  author_name?: string | null;
  body: string;
  created_at: string;
}
