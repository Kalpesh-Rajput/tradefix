"use client";

import { useMemo } from "react";
import { BarChart3, Plus } from "lucide-react";

import { AggregationSelector } from "@/components/reports/AggregationSelector";
import { ChartOverflowMenu } from "@/components/reports/ChartOverflowMenu";
import { MetricSelector } from "@/components/reports/MetricSelector";
import { PerformanceChart } from "@/components/reports/PerformanceChart";
import { PNL_LOSS_HEX, PNL_PROFIT_HEX, CHART_LINE_HEX } from "@/lib/appearance";
import { addDays, parseLocalIso, startOfWeekSunday } from "@/lib/dateLocal";
import { getReportMetric } from "@/lib/reports/metrics";
import { seriesFromSnapshots } from "@/lib/reports/series";
import type {
  MoneyFormatter,
  ReportAggregation,
  ReportChartConfig,
  ReportSnapshotSet,
} from "@/lib/reports/types";

function periodTooltipDate(iso: string, aggregation: ReportAggregation): string {
  if (aggregation === "month") return iso.slice(0, 7);
  if (aggregation === "week") {
    const start = startOfWeekSunday(parseLocalIso(iso));
    const end = addDays(start, 6);
    const endIso = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
    const startIso = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    return `${startIso} – ${endIso}`;
  }
  return iso;
}

export function ReportChartCard({
  config,
  snapshots,
  formatMoney,
  formatChartDate,
  canRemove,
  onChange,
  onAdd,
  onDuplicate,
  onRemove,
}: {
  config: ReportChartConfig;
  snapshots: ReportSnapshotSet;
  formatMoney: MoneyFormatter;
  formatChartDate: (value: Date | string | number, style?: "short" | "monthYear") => string;
  canRemove: boolean;
  onChange: (next: ReportChartConfig) => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const metric = getReportMetric(config.metricId);
  const source = snapshots[config.aggregation];

  const series = useMemo(() => {
    const points = seriesFromSnapshots(source, metric.id, (iso) => {
      if (config.aggregation === "month") {
        return formatChartDate(new Date(`${iso}T12:00:00`), "monthYear");
      }
      if (config.aggregation === "week") {
        return formatChartDate(startOfWeekSunday(parseLocalIso(iso)));
      }
      return formatChartDate(new Date(`${iso}T12:00:00`));
    });
    return points.map((p) => ({
      ...p,
      tooltipDate: periodTooltipDate(p.iso, config.aggregation),
    }));
  }, [source, metric.id, config.aggregation, formatChartDate]);

  const last = series[series.length - 1]?.value ?? 0;
  const accent = metric.signed
    ? last < 0
      ? PNL_LOSS_HEX
      : PNL_PROFIT_HEX
    : CHART_LINE_HEX;

  return (
    <article className="dash-card flex h-full min-h-0 min-w-0 flex-col p-3.5">
      <header className="flex h-11 shrink-0 items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <BarChart3 className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" aria-hidden />
          <MetricSelector
            metricId={metric.id}
            accent={accent}
            onChange={(metricId) => onChange({ ...config, metricId })}
          />
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex h-8 shrink-0 items-center gap-0.5 whitespace-nowrap rounded-md px-1.5 text-[12px] font-medium text-primary outline-none hover:bg-[var(--color-primary-very-light)] focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add metric
          </button>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <AggregationSelector
            value={config.aggregation}
            onChange={(aggregation) => onChange({ ...config, aggregation })}
          />
          <ChartOverflowMenu canRemove={canRemove} onDuplicate={onDuplicate} onRemove={onRemove} />
        </div>
      </header>

      <div className="w-full min-w-0 flex-1" style={{ minHeight: 268 }}>
        <PerformanceChart series={series} metric={metric} formatMoney={formatMoney} />
      </div>

      <footer className="mt-1 flex h-7 shrink-0 items-center justify-center gap-1.5 text-[11px] text-[var(--color-text-secondary)]">
        {metric.signed ? (
          <>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: PNL_PROFIT_HEX }} aria-hidden />
            <span className="-ml-1 h-1.5 w-1.5 rounded-full" style={{ background: PNL_LOSS_HEX }} aria-hidden />
          </>
        ) : (
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} aria-hidden />
        )}
        {metric.legendLabel}
      </footer>
    </article>
  );
}
