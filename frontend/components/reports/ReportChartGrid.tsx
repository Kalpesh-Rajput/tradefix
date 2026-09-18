"use client";

import { useMemo, useState } from "react";

import { ReportChartCard } from "@/components/reports/ReportChartCard";
import {
  createReportChartConfig,
  defaultReportCharts,
  duplicateReportChart,
} from "@/lib/reports/charts";
import { buildReportSnapshots } from "@/lib/reports/series";
import type { MoneyFormatter, ReportChartConfig, ReportSnapshotSet } from "@/lib/reports/types";
import type { Trade } from "@/lib/types";

export function ReportChartGrid({
  trades,
  displayPnl,
  formatMoney,
  dateKey,
  formatChartDate,
  dateFrom,
  dateTo,
  initialBalance,
}: {
  trades: Trade[];
  displayPnl: (pnl: number | null | undefined, fees?: number | null) => number | null;
  formatMoney: MoneyFormatter;
  dateKey: (value: Date | string | number) => string;
  formatChartDate: (value: Date | string | number, style?: "short" | "monthYear") => string;
  dateFrom?: string;
  dateTo?: string;
  initialBalance: number;
}) {
  const [charts, setCharts] = useState<ReportChartConfig[]>(() => defaultReportCharts());

  const snapshots: ReportSnapshotSet = useMemo(
    () =>
      buildReportSnapshots({
        trades,
        displayPnl,
        dateKey,
        dateFrom,
        dateTo,
        initialBalance,
      }),
    [trades, displayPnl, dateKey, dateFrom, dateTo, initialBalance]
  );

  const visible = charts.filter((c) => c.visible).sort((a, b) => a.order - b.order);

  function updateChart(id: string, next: ReportChartConfig) {
    setCharts((prev) => prev.map((c) => (c.id === id ? next : c)));
  }

  function addChart() {
    setCharts((prev) => [...prev, createReportChartConfig({ order: prev.length })]);
  }

  function duplicateChart(chart: ReportChartConfig) {
    setCharts((prev) => {
      const idx = prev.findIndex((c) => c.id === chart.id);
      const copy = duplicateReportChart(chart, chart.order + 1);
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next.map((c, i) => ({ ...c, order: i }));
    });
  }

  function removeChart(id: string) {
    setCharts((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((c) => c.id !== id).map((c, i) => ({ ...c, order: i }));
    });
  }

  return (
    <div
      className={
        visible.length > 1
          ? "grid grid-cols-1 items-stretch gap-3 lg:grid-cols-2"
          : "grid grid-cols-1 items-stretch gap-3"
      }
    >
      {visible.map((chart) => (
        <ReportChartCard
          key={chart.id}
          config={chart}
          snapshots={snapshots}
          formatMoney={formatMoney}
          formatChartDate={formatChartDate}
          canRemove={visible.length > 1}
          onChange={(next) => updateChart(chart.id, next)}
          onAdd={addChart}
          onDuplicate={() => duplicateChart(chart)}
          onRemove={() => removeChart(chart.id)}
        />
      ))}
    </div>
  );
}
