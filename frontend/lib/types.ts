export type AssetType = "stock" | "option" | "future" | "forex" | "crypto";
export type TradeSide = "long" | "short";
export type TradeStatus = "open" | "closed";

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
  setup_tag: string | null;
  mood: string | null;
  notes: string | null;
  rules_broken: string[];
  status: TradeStatus;
  created_at: string;
}

export interface TradeInput {
  symbol: string;
  asset_type: AssetType;
  side: TradeSide;
  quantity: number;
  entry_price: number;
  exit_price?: number | null;
  opened_at: string;
  closed_at?: string | null;
  fees?: number;
  setup_tag?: string | null;
  mood?: string | null;
  notes?: string | null;
  rules_broken?: string[];
  status: TradeStatus;
}

export interface OverviewStats {
  total_trades: number;
  win_rate: number;
  total_pnl: number;
  avg_win: number;
  avg_loss: number;
  current_streak: number;
  current_streak_type: "win" | "loss" | "none";
  best_day_pnl: number;
  worst_day_pnl: number;
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

export interface MoodPnlPoint {
  mood_score: number;
  trades: number;
  avg_pnl: number;
  win_rate: number;
}

export interface AnalyticsResponse {
  overview: OverviewStats;
  by_hour: TimeBucketStat[];
  by_day_of_week: TimeBucketStat[];
  by_setup: SetupStat[];
  mood_vs_pnl: MoodPnlPoint[];
}

export interface CalendarDay {
  date: string;
  trades: number;
  pnl: number;
  win_rate: number;
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
}
