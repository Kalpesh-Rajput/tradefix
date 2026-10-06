"use client";

import type { ReactNode } from "react";

import { InfoTooltip } from "@/components/ui/InfoTooltip";

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
        hint="Shows the running total of daily P&L from the start of the selected range. The line rises when you are profitable and falls when you are not."
      >
        <PerformanceChart series={cumulative} metric={cumMetric} formatMoney={formatMoney} height={CHART_H} />
      </OverviewChartCard>
      <OverviewChartCard
        title={net ? "Net daily P&L" : "Gross daily P&L"}
        rangeLabel={rangeLabel}
        hint="Shows P&L realized on each trading day. Green is a profitable day and red is a losing day. Use it to spot streaks and possible revenge-trading days."
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
        <div className="flex min-w-0 items-start gap-1">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1">
              <h3 className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-primary)]">
                {title}
              </h3>
              <InfoTooltip content={hint} label={title} />
            </div>
            <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
              ({rangeLabel})
            </p>
          </div>
        </div>
      </header>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}
