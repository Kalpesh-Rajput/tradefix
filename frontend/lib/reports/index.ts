export type { ReportAggregation, ReportChartConfig, ReportMetricDef, ReportSnapshotSet } from "@/lib/reports/types";
export { REPORT_METRICS, DEFAULT_REPORT_METRIC_ID, getReportMetric, metricsByCategory, searchReportMetrics } from "@/lib/reports/metrics";
export { buildReportSnapshots, seriesFromSnapshots } from "@/lib/reports/series";
export { filterReportTrades } from "@/lib/reports/filter";
export { formatMetricValue, formatAxisValue, formatDurationLong, formatRMultiple } from "@/lib/reports/format";
export { displayPnlForMode, formatReportRangeLabel, REPORT_PNL_MODES } from "@/lib/reports/pnlMode";
export { buildOverviewModel } from "@/lib/reports/overview";
export type { ReportPnlMode, DisplayPnlFn } from "@/lib/reports/types";
export { createReportChartConfig, defaultReportCharts, duplicateReportChart, AGGREGATION_LABELS } from "@/lib/reports/charts";
export {
  ANALYTICS_REPORTS,
  REPORT_BY_ID,
  isAnalyticsReportId,
  parseReportsView,
  parseReportSub,
  parseTopN,
  parseHourBucket,
  tabDef,
  TOP_N_OPTIONS,
  HOUR_BUCKET_OPTIONS,
} from "@/lib/reports/catalog";
export type { AnalyticsReportId, ReportsView, ReportSubId, ReportDef, ReportTabDef } from "@/lib/reports/catalog";
export {
  groupByDimension,
  summarizeGroups,
  rankGroups,
  dimensionMetricLabel,
  DIMENSION_METRICS,
  outcomeStats,
  metricValue,
} from "@/lib/reports/group";
export type { GroupBucket, GroupSummary, DimensionMetricId, DimensionKind, OutcomeStats } from "@/lib/reports/group";
