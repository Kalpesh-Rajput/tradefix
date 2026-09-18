/** Progress Tracker types — discipline rules, not P&L. */

export type RuleStatus = "passed" | "failed" | "pending" | "not_applicable";
export type RuleKind = "builtin" | "manual";
export type LossMode = "amount" | "percent";
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export const WEEKDAYS: { id: Weekday; short: string; label: string }[] = [
  { id: "mon", short: "Mo", label: "Monday" },
  { id: "tue", short: "Tu", label: "Tuesday" },
  { id: "wed", short: "We", label: "Wednesday" },
  { id: "thu", short: "Th", label: "Thursday" },
  { id: "fri", short: "Fr", label: "Friday" },
  { id: "sat", short: "Sa", label: "Saturday" },
  { id: "sun", short: "Su", label: "Sunday" },
];

export const WEEKDAY_PRESETS: { id: string; label: string; days: Weekday[] }[] = [
  { id: "all", label: "All", days: WEEKDAYS.map((d) => d.id) },
  { id: "weekdays", label: "Mon-Fri", days: ["mon", "tue", "wed", "thu", "fri"] },
  { id: "mon", label: "Monday", days: ["mon"] },
  { id: "tue", label: "Tuesday", days: ["tue"] },
  { id: "wed", label: "Wednesday", days: ["wed"] },
  { id: "thu", label: "Thursday", days: ["thu"] },
  { id: "fri", label: "Friday", days: ["fri"] },
  { id: "sat", label: "Saturday", days: ["sat"] },
  { id: "sun", label: "Sunday", days: ["sun"] },
];

export type ManualRule = {
  id: string;
  name: string;
  schedule: Weekday[];
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ManualRuleDraft = {
  id?: string;
  clientId: string;
  name: string;
  schedule: Weekday[];
  sort_order: number;
  is_active: boolean;
};

export type ProgressSettings = {
  active_days: Weekday[];
  reminder_enabled: boolean;
  reminder_time: string;
  trading_hours_enabled: boolean;
  trading_start_time: string;
  trading_end_time: string;
  start_day_enabled: boolean;
  start_day_time: string;
  link_playbook_enabled: boolean;
  stop_loss_required: boolean;
  max_loss_per_trade_enabled: boolean;
  max_loss_per_trade_mode: LossMode;
  max_loss_per_trade_value: number;
  max_loss_per_day_enabled: boolean;
  max_loss_per_day_value: number;
  timezone: string;
  manual_rules: ManualRule[];
};

export type ProgressSettingsPayload = Omit<ProgressSettings, "timezone" | "manual_rules"> & {
  manual_rules: {
    id?: string;
    name: string;
    schedule: Weekday[];
    sort_order: number;
    is_active: boolean;
  }[];
};

export type RuleResult = {
  rule_key: string;
  rule_id: string | null;
  name: string;
  kind: RuleKind;
  status: RuleStatus;
  condition: string | null;
  detail: string | null;
  metadata: Record<string, unknown>;
};

export type DailyProgress = {
  date: string;
  is_trading_day: boolean;
  participated: boolean;
  started_at: string | null;
  total_rules: number;
  passed: number;
  failed: number;
  pending: number;
  not_applicable: number;
  score: number | null;
  tracking: boolean;
  rules: RuleResult[];
};

export type HeatmapCell = {
  date: string;
  score: number | null;
  passed: number;
  failed: number;
  pending: number;
  total_applicable: number;
  is_trading_day: boolean;
  participated: boolean;
  tracking: boolean;
  future: boolean;
};

export type RuleAnalytics = {
  rule_key: string;
  rule_id: string | null;
  name: string;
  kind: RuleKind;
  condition: string | null;
  streak: number;
  follow_rate: number | null;
  average_performance: string | null;
  passed: number;
  failed: number;
  pending: number;
  applicable: number;
};

export type ProgressSummary = {
  timezone: string;
  today: string;
  focus_date: string;
  current_streak: number;
  period_score: number | null;
  today_passed: number;
  today_total: number;
  settings: ProgressSettings;
  checklist: DailyProgress;
  heatmap: HeatmapCell[];
  rules: RuleAnalytics[];
};

export type StartDayResult = {
  date: string;
  started_at: string;
  created: boolean;
  already_started: boolean;
};

export function schedulePresetId(days: Weekday[]): string {
  const key = [...days].sort().join(",");
  const match = WEEKDAY_PRESETS.find((p) => [...p.days].sort().join(",") === key);
  return match?.id ?? "custom";
}
