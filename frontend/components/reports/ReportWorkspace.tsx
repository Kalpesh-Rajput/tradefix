"use client";

import { useMemo } from "react";

import { CompactSelect } from "@/components/reports/CompactSelect";
import { GroupedChartPair } from "@/components/reports/GroupedReportChart";
import { PnlModeSelector } from "@/components/reports/PnlModeSelector";
import { ReportSegmentedControl } from "@/components/reports/ReportSegmentedControl";
import { ReportSummaryCards } from "@/components/reports/ReportSummaryCards";
import {
  HOUR_BUCKET_OPTIONS,
  REPORT_BY_ID,
  TOP_N_OPTIONS,
  tabDef,
  type AnalyticsReportId,
} from "@/lib/reports/catalog";
import { formatMetricValue } from "@/lib/reports/format";
import {
  groupByDimension,
  outcomeStats,
  rankGroups,
  summarizeGroups,
} from "@/lib/reports/group";
import type { DisplayPnlFn, MoneyFormatter, ReportPnlMode } from "@/lib/reports/types";
import type { Trade } from "@/lib/types";

export function ReportWorkspace({
  reportId,
  sub,
  onSub,
  trades,
  displayPnl,
  pnlMode,
  onPnlMode,
  formatMoney,
  timeZone,
  topN,
  onTopN,
  hourBucket,
  onHourBucket,
  useExit,
  onUseExit,
}: {
  reportId: AnalyticsReportId;
  sub: string;
  onSub: (sub: string) => void;
  trades: Trade[];
  displayPnl: DisplayPnlFn;
  pnlMode: ReportPnlMode;
  onPnlMode: (mode: ReportPnlMode) => void;
  formatMoney: MoneyFormatter;
  timeZone: string;
  topN: number;
  onTopN: (n: number) => void;
  hourBucket: number;
  onHourBucket: (minutes: number) => void;
  useExit: boolean;
  onUseExit: (useExit: boolean) => void;
}) {
  const def = REPORT_BY_ID.get(reportId);
  const tab = tabDef(reportId, sub) ?? def?.tabs[0];
  const groups = useMemo(() => {
    if (!tab) return [];
    return groupByDimension(tab.kind, trades, displayPnl, {
      timeZone,
      bucketMinutes: hourBucket,
      useExit,
    });
  }, [tab, trades, displayPnl, timeZone, hourBucket, useExit]);

  const live = useMemo(() => groups.filter((g) => g.trades > 0), [groups]);
  const summary = useMemo(() => summarizeGroups(groups), [groups]);
  const chartGroups = useMemo(
    () => (tab?.ranked ? rankGroups(groups, topN) : groups),
    [tab, groups, topN]
  );

  if (!def || !tab) return null;

  const emptyMessage = tab.empty ?? def.empty;
  const hasData = live.length > 0;
  const showTabs = def.tabs.length > 1;
  const showTimeControls = reportId === "day-time" && tab.id === "trade-time";
  const showTopN = !!tab.ranked;
  const wins = reportId === "wins-vs-losses" ? outcomeStats(trades, displayPnl) : null;

  return (
    <div className="space-y-3">
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-2">
        {showTabs ? (
          <ReportSegmentedControl
            ariaLabel={`${def.label} views`}
            value={tab.id}
            options={def.tabs.map((t) => ({ id: t.id, label: t.label }))}
            onChange={onSub}
          />
        ) : (
          <div />
        )}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {showTimeControls ? (
            <>
              <ReportSegmentedControl
                ariaLabel="Time basis"
                value={useExit ? "exit" : "entry"}
                options={[
                  { id: "entry", label: "Entry time" },
                  { id: "exit", label: "Exit time" },
                ]}
                onChange={(v) => onUseExit(v === "exit")}
              />
              <CompactSelect
                ariaLabel="Time bucket"
                value={String(hourBucket)}
                options={HOUR_BUCKET_OPTIONS.map((o) => ({ id: String(o.minutes), label: o.label }))}
                onChange={(v) => onHourBucket(Number(v))}
                width={120}
              />
            </>
          ) : null}
          {showTopN ? (
            <CompactSelect
              ariaLabel="Top symbols"
              value={String(topN)}
              options={TOP_N_OPTIONS.map((n) => ({ id: String(n), label: `Top ${n}` }))}
              onChange={(v) => onTopN(Number(v))}
              width={110}
            />
          ) : null}
          <PnlModeSelector value={pnlMode} onChange={onPnlMode} compact />
        </div>
      </div>

      {!hasData ? (
        <div className="dash-card px-4 py-10 text-center text-[13px] text-[var(--color-text-muted)]">
          {emptyMessage}
        </div>
      ) : wins ? (
        <WinsVsLossesBody
          wins={wins}
          groups={chartGroups}
          pnlMode={pnlMode}
          formatMoney={formatMoney}
        />
      ) : (
        <>
          <ReportSummaryCards summary={summary} copy={tab.cards} formatMoney={formatMoney} />
          <GroupedChartPair key={`${reportId}-${tab.id}`} groups={chartGroups} pnlMode={pnlMode} formatMoney={formatMoney} />
        </>
      )}
    </div>
  );
}

function WinsVsLossesBody({
  wins,
  groups,
  pnlMode,
  formatMoney,
}: {
  wins: ReturnType<typeof outcomeStats>;
  groups: ReturnType<typeof rankGroups>;
  pnlMode: ReportPnlMode;
  formatMoney: MoneyFormatter;
}) {
  const closed = wins.wins + wins.losses + wins.be;
  const rows = [
    { label: "Winning trades", value: String(wins.wins) },
    { label: "Losing trades", value: String(wins.losses) },
    { label: "Break-even trades", value: String(wins.be) },
    { label: "Win rate", value: `${wins.winRate.toFixed(wins.winRate % 1 ? 2 : 0)}%` },
    {
      label: "Average winning trade",
      value: wins.avgWin == null ? "—" : formatMetricValue(wins.avgWin, "currency", formatMoney),
    },
    {
      label: "Average losing trade",
      value: wins.avgLoss == null ? "—" : formatMetricValue(wins.avgLoss, "currency", formatMoney),
    },
    {
      label: "Largest win",
      value: wins.largestWin == null ? "—" : formatMetricValue(wins.largestWin, "currency", formatMoney),
    },
    {
      label: "Largest loss",
      value: wins.largestLoss == null ? "—" : formatMetricValue(wins.largestLoss, "currency", formatMoney),
    },
    { label: "Profit factor", value: wins.profitFactor == null ? "—" : wins.profitFactor.toFixed(2) },
    { label: "Closed trades", value: String(closed) },
  ];

  return (
    <>
      <ReportSummaryCards
        summary={{
          best: groups.find((g) => g.key === "win") ?? null,
          least: groups.find((g) => g.key === "loss") ?? null,
          mostActive: groups.find((g) => g.key === "be") ?? null,
          bestWinRate: {
            key: "wr",
            label: `${wins.winRate.toFixed(wins.winRate % 1 ? 2 : 0)}%`,
            fullLabel: `${wins.winRate.toFixed(wins.winRate % 1 ? 2 : 0)}%`,
            order: 0,
            trades: closed,
            wins: wins.wins,
            losses: wins.losses,
            be: wins.be,
            pnl: wins.winPnl + wins.lossPnl,
            winRate: wins.winRate,
          },
        }}
        copy={{
          best: "Winning trades",
          least: "Losing trades",
          mostActive: "Break-even trades",
          bestWinRate: "Win rate",
        }}
        formatMoney={formatMoney}
        winRateAsPrimary
      />
      <GroupedChartPair groups={groups} pnlMode={pnlMode} formatMoney={formatMoney} />
      <section className="dash-card p-4 sm:p-5">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-primary)]">
          Outcome details
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-10 gap-y-2 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4 border-b border-[var(--color-border-subtle)] py-2">
              <dt className="text-[12px] text-[var(--color-text-secondary)]">{row.label}</dt>
              <dd className="text-[12px] font-medium tabular-nums text-[var(--color-text-primary)]">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
