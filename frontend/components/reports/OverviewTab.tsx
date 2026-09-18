"use client";

import { useMemo } from "react";

import { OverviewCharts } from "@/components/reports/OverviewCharts";
import { OverviewStatsCard } from "@/components/reports/OverviewStatsCard";
import { PnlModeSelector } from "@/components/reports/PnlModeSelector";
import { buildOverviewModel } from "@/lib/reports/overview";
import { formatReportRangeLabel } from "@/lib/reports/pnlMode";
import type { DisplayPnlFn, MoneyFormatter, ReportPnlMode } from "@/lib/reports/types";
import type { Trade } from "@/lib/types";

export function OverviewTab({
  trades,
  displayPnl,
  pnlMode,
  onPnlMode,
  formatMoney,
  dateKey,
  formatChartDate,
  dateFrom,
  dateTo,
  initialBalance,
}: {
  trades: Trade[];
  displayPnl: DisplayPnlFn;
  pnlMode: ReportPnlMode;
  onPnlMode: (mode: ReportPnlMode) => void;
  formatMoney: MoneyFormatter;
  dateKey: (value: Date | string | number) => string;
  formatChartDate: (value: Date | string | number, style?: "short" | "monthYear") => string;
  dateFrom?: string;
  dateTo?: string;
  initialBalance: number;
}) {
  const rangeLabel = formatReportRangeLabel(dateFrom, dateTo);
  const model = useMemo(
    () =>
      buildOverviewModel({
        trades,
        displayPnl,
        dateKey,
        formatChartDate,
        dateFrom,
        dateTo,
        initialBalance,
        formatMoney,
      }),
    [trades, displayPnl, dateKey, formatChartDate, dateFrom, dateTo, initialBalance, formatMoney]
  );

  return (
    <div className="space-y-4">
      <PnlModeSelector value={pnlMode} onChange={onPnlMode} />
      <OverviewStatsCard model={model} rangeLabel={rangeLabel} formatMoney={formatMoney} />
      <OverviewCharts
        pnlMode={pnlMode}
        rangeLabel={rangeLabel}
        cumulative={model.cumulative}
        daily={model.daily}
        formatMoney={formatMoney}
      />
    </div>
  );
}
