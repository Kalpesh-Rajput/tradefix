export const REPORT_METRIC_CATEGORIES = [
  "Time Analysis",
  "Profitability",
  "Risk & Drawdown",
  "Trading Activity & Volume",
  "Streaks & Consistency",
] as const;

export type ReportMetricCategory = (typeof REPORT_METRIC_CATEGORIES)[number];

export const REPORT_AGGREGATIONS = ["day", "week", "month"] as const;
export type ReportAggregation = (typeof REPORT_AGGREGATIONS)[number];

export type ReportValueType = "currency" | "duration" | "count" | "percent" | "ratio";
export type ReportChartType = "signedArea" | "area" | "bar";

export type ReportMetricDef = {
  id: string;
  label: string;
  legendLabel: string;
  category: ReportMetricCategory;
  valueType: ReportValueType;
  chartType: ReportChartType;
  signed: boolean;
};

export type ReportChartConfig = {
  id: string;
  metricId: string;
  aggregation: ReportAggregation;
  visible: boolean;
  order: number;
};

export type ReportSeriesPoint = {
  iso: string;
  label: string;
  tooltipDate: string;
  value: number;
  periodPnl: number;
};

export type ReportSnapshot = {
  iso: string;
  tooltipDate: string;
  periodPnl: number;
  values: Record<string, number>;
};

export type ReportSnapshotSet = {
  day: ReportSnapshot[];
  week: ReportSnapshot[];
  month: ReportSnapshot[];
};

export type ReportPnlMode = "net" | "gross";

export type MoneyFormatter = (n: number, opts?: { signed?: boolean; digits?: number }) => string;

export type DisplayPnlFn = (pnl: number | null | undefined, fees?: number | null) => number | null;
