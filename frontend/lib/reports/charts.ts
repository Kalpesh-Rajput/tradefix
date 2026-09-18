import { DEFAULT_REPORT_METRIC_ID } from "@/lib/reports/metrics";
import type { ReportAggregation, ReportChartConfig } from "@/lib/reports/types";

export function createReportChartConfig(
  overrides?: Partial<Omit<ReportChartConfig, "id">> & { id?: string }
): ReportChartConfig {
  return {
    id: overrides?.id ?? createChartId(),
    metricId: overrides?.metricId ?? DEFAULT_REPORT_METRIC_ID,
    aggregation: overrides?.aggregation ?? "day",
    visible: overrides?.visible ?? true,
    order: overrides?.order ?? 0,
  };
}

export function defaultReportCharts(): ReportChartConfig[] {
  return [
    createReportChartConfig({ order: 0, metricId: DEFAULT_REPORT_METRIC_ID }),
    createReportChartConfig({ order: 1, metricId: "avg_daily_win_loss_cumulative" }),
  ];
}

export function duplicateReportChart(chart: ReportChartConfig, order: number): ReportChartConfig {
  return createReportChartConfig({
    metricId: chart.metricId,
    aggregation: chart.aggregation,
    visible: true,
    order,
  });
}

export const AGGREGATION_LABELS: Record<ReportAggregation, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
};

function createChartId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `chart_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
