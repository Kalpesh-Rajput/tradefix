import type { TradeFixScoreMetricKey } from "@/lib/types";

export const SCORE_METRIC_ORDER: TradeFixScoreMetricKey[] = [
  "win_rate",
  "profit_factor",
  "average_win_loss",
  "recovery_factor",
  "drawdown",
  "consistency",
];

export const SCORE_METRIC_LABEL: Record<TradeFixScoreMetricKey, string> = {
  win_rate: "Win %",
  profit_factor: "Profit Factor",
  average_win_loss: "Avg Win/Loss",
  recovery_factor: "Recovery Factor",
  drawdown: "Drawdown",
  consistency: "Consistency",
};

export const SCORE_METRIC_SHORT: Record<TradeFixScoreMetricKey, string> = {
  win_rate: "Win %",
  profit_factor: "PF",
  average_win_loss: "W/L",
  recovery_factor: "Rec",
  drawdown: "DD",
  consistency: "Cons",
};

export function scoreBand(score: number | null): { label: string; hint: string } {
  if (score == null) return { label: "No data", hint: "Complete closed trades to generate a profile." };
  if (score < 40) return { label: "Developing", hint: "Descriptive guidance, not a grade of skill." };
  if (score < 60) return { label: "Building", hint: "Descriptive guidance, not a grade of skill." };
  if (score < 80) return { label: "Solid", hint: "Descriptive guidance, not a grade of skill." };
  return { label: "Strong", hint: "Descriptive guidance, not a grade of skill." };
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
