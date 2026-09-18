"use client";

import { Info } from "lucide-react";
import type { ReactNode } from "react";

import { PerformanceChart } from "@/components/reports/PerformanceChart";
import { getReportMetric } from "@/lib/reports/metrics";
import type { MoneyFormatter, ReportMetricDef, ReportPnlMode, ReportSeriesPoint } from "@/lib/reports/types";

const CHART_H = 240;

export function OverviewCharts({
  pnlMode,
  rangeLabel,
  cumulative,
  daily,
  formatMoney,
}: {
  pnlMode: ReportPnlMode;
  rangeLabel: string;
  cumulative: ReportSeriesPoint[];
  daily: ReportSeriesPoint[];
  formatMoney: MoneyFormatter;
}) {
  const net = pnlMode === "net";
  const cumMetric: ReportMetricDef = {
    ...getReportMetric("net_pnl_cumulative"),
    label: net ? "Daily net cumulative P&L" : "Daily gross cumulative P&L",
    legendLabel: net ? "Net P&L" : "Gross P&L",
  };
  const dailyMetric: ReportMetricDef = {
    ...getReportMetric("daily_net_pnl"),
    label: net ? "Net daily P&L" : "Gross daily P&L",
    legendLabel: net ? "Net daily P&L" : "Gross daily P&L",
  };

  return (
    <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-2">
      <OverviewChartCard
        title={net ? "Daily net cumulative P&L" : "Daily gross cumulative P&L"}
        rangeLabel={rangeLabel}
        hint="Sum of daily P&L from the start of the selected range through each day."
      >
        <PerformanceChart series={cumulative} metric={cumMetric} formatMoney={formatMoney} height={CHART_H} />
      </OverviewChartCard>
      <OverviewChartCard
        title={net ? "Net daily P&L" : "Gross daily P&L"}
        rangeLabel={rangeLabel}
        hint="P&L realized on each trading day. Green is profit, red is loss."
      >
        <PerformanceChart series={daily} metric={dailyMetric} formatMoney={formatMoney} height={CHART_H} />
      </OverviewChartCard>
    </div>
  );
}

function OverviewChartCard({
  title,
  rangeLabel,
  hint,
  children,
}: {
  title: string;
  rangeLabel: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className="dash-card flex h-full min-w-0 flex-col p-3.5">
      <header className="mb-2 flex h-11 shrink-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-primary)]">
            {title}
          </h3>
          <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
            ({rangeLabel})
          </p>
        </div>
        <button
          type="button"
          title={hint}
          aria-label={hint}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--color-text-muted)] outline-none hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-secondary)] focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <Info className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        </button>
      </header>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}
