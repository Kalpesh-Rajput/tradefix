import { BAR_LOSS_HEX, BAR_PROFIT_HEX, COUNT_SERIES_HEX } from "@/lib/appearance";
import type { DashboardPerformance, NamedPerformance, PerformanceCounts } from "@/lib/types";

import { compactMoney, formatPct, type MoneyFormat } from "./shared";

/**
 * Metrics that dashboard analytics already computes for every breakdown.
 * Expectancy is omitted: stats_service.expectancy is the same value as avg_pnl.
 */
export type InsightMetricId =
  | "pnl"
  | "gross_profit"
  | "win_rate"
  | "trades"
  | "avg_pnl"
  | "avg_win"
  | "avg_loss"
  | "profit_factor";

export type InsightChartId =
  | "symbols"
  | "entryConditions"
  | "exitConditions"
  | "timeframes"
  | "sessions"
  | "tradeTypes"
  | "mood"
  | "strategies"
  | "mistakes";

export type InsightMetricKind = "signed" | "positiveMoney" | "percent" | "count" | "ratio";

export type InsightMetric = {
  id: InsightMetricId;
  label: string;
  kind: InsightMetricKind;
};

export type InsightSortDirection = "desc" | "asc";

export type InsightRow = PerformanceCounts & { name: string };

const SUPPORTED_METRICS: InsightMetricId[] = [
  "pnl",
  "gross_profit",
  "win_rate",
  "trades",
  "avg_pnl",
  "avg_win",
  "avg_loss",
  "profit_factor",
];

export const INSIGHT_METRICS: Record<InsightMetricId, InsightMetric> = {
  pnl: { id: "pnl", label: "Net P&L", kind: "signed" },
  gross_profit: { id: "gross_profit", label: "Profit", kind: "positiveMoney" },
  win_rate: { id: "win_rate", label: "Win rate", kind: "percent" },
  trades: { id: "trades", label: "Trades", kind: "count" },
  avg_pnl: { id: "avg_pnl", label: "Average P&L", kind: "signed" },
  avg_win: { id: "avg_win", label: "Average win", kind: "positiveMoney" },
  avg_loss: { id: "avg_loss", label: "Average loss", kind: "signed" },
  profit_factor: { id: "profit_factor", label: "Profit factor", kind: "ratio" },
};

/** Every breakdown row carries the same counts, so each chart can offer the same metrics. */
export const insightMetricConfig: Record<InsightChartId, InsightMetricId[]> = {
  symbols: SUPPORTED_METRICS,
  entryConditions: SUPPORTED_METRICS,
  exitConditions: SUPPORTED_METRICS,
  timeframes: SUPPORTED_METRICS,
  sessions: SUPPORTED_METRICS,
  tradeTypes: SUPPORTED_METRICS,
  mood: SUPPORTED_METRICS,
  strategies: SUPPORTED_METRICS,
  mistakes: SUPPORTED_METRICS,
};

export function insightMetricValue(row: PerformanceCounts, id: InsightMetricId): number | null {
  const value = row[id];
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

export function formatInsightMetric(
  metric: InsightMetric,
  value: number | null,
  currencySymbol: string,
  formatMoney: MoneyFormat,
  precise = false
): string {
  if (value == null) return "—";
  if (metric.kind === "percent") return formatPct(value);
  if (metric.kind === "count") return String(Math.round(value));
  if (metric.kind === "ratio") return value.toFixed(2);
  const abs = Math.abs(value);
  if (!precise && abs >= 100) return compactMoney(value, currencySymbol, true);
  if (precise && abs >= 10_000) return compactMoney(value, currencySymbol, true);
  return formatMoney(value, { signed: true, digits: precise || abs < 100 ? 2 : 0 });
}

export function insightBarColor(metric: InsightMetric, value: number | null): string | null {
  if (value == null || value === 0) return null;
  if (metric.kind === "signed") {
    return value > 0 ? BAR_PROFIT_HEX : BAR_LOSS_HEX;
  }
  if (metric.kind === "count") return COUNT_SERIES_HEX;
  return BAR_PROFIT_HEX;
}

export function insightBarWidth(metric: InsightMetric, value: number | null, maxAbs: number): number {
  if (value == null) return 0;
  if (metric.kind === "percent") return Math.max(0, Math.min(100, value));
  if (maxAbs <= 0) return 0;
  return Math.max(0, Math.min(100, (Math.abs(value) / maxAbs) * 100));
}

export function sortInsightRows(
  rows: InsightRow[],
  metricId: InsightMetricId,
  direction: InsightSortDirection
): InsightRow[] {
  return [...rows].sort((a, b) => {
    const av = insightMetricValue(a, metricId);
    const bv = insightMetricValue(b, metricId);
    const aMissing = av == null;
    const bMissing = bv == null;
    if (aMissing && bMissing) return a.name.localeCompare(b.name);
    if (aMissing) return 1;
    if (bMissing) return -1;
    const diff = direction === "desc" ? bv - av : av - bv;
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name);
  });
}

function namedRows(rows: NamedPerformance[] | null | undefined): InsightRow[] {
  if (!rows?.length) return [];
  return rows.filter((row) => row.trades > 0 && row.name.trim());
}

export function insightChartSources(data: DashboardPerformance): {
  id: InsightChartId;
  title: string;
  rows: InsightRow[];
}[] {
  const insights = data.insights;
  return [
    {
      id: "symbols",
      title: "Symbols",
      rows: (data.symbols ?? [])
        .filter((row) => row.trades > 0 && row.symbol.trim())
        .map((row) => ({ ...row, name: row.symbol })),
    },
    { id: "entryConditions", title: "Entry Conditions", rows: namedRows(insights?.entries) },
    { id: "exitConditions", title: "Exit Conditions", rows: namedRows(insights?.exits) },
    { id: "timeframes", title: "Timeframes", rows: namedRows(insights?.timeframes) },
    { id: "sessions", title: "Sessions", rows: namedRows(insights?.sessions) },
    { id: "tradeTypes", title: "Trade Types", rows: namedRows(insights?.trade_types) },
    { id: "mood", title: "Mood", rows: namedRows(insights?.moods) },
    {
      id: "strategies",
      title: "Strategies",
      rows: (data.strategies ?? [])
        .filter((row) => row.trades > 0 && row.name.trim())
        .map((row) => ({ ...row, name: row.name })),
    },
    { id: "mistakes", title: "Mistakes", rows: namedRows(insights?.mistakes) },
  ];
}
