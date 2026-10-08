"use client";

import { useState } from "react";

import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { useLocale } from "@/components/providers/LocaleProvider";
import type { DashboardPerformance, NamedPerformance } from "@/lib/types";

import { InsightBarChart, InsightChartBoundary } from "./InsightBarChart";
import { INSIGHT_METRICS, insightChartSources, insightMetricConfig } from "./insightMetrics";
import { AnalyticsEmpty, compactMoney, formatPct, pnlClass, tradeLabel, type MoneyFormat } from "./shared";

function InsightTile({
  label,
  insight,
  currencySymbol,
  extra,
  empty,
}: {
  label: string;
  insight: NamedPerformance | null;
  currencySymbol: string;
  extra?: { label: string; value: string }[];
  empty: string;
}) {
  return (
    <article className="min-w-0 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{label}</p>
      {!insight || insight.trades <= 0 ? (
        <p className="mt-2 text-[12px] leading-4 text-[var(--color-text-muted)]">{empty}</p>
      ) : (
        <>
          <p className="mt-1 truncate text-[15px] font-bold text-[var(--color-text-primary)]" title={insight.name}>
            {insight.name}
          </p>
          <dl className="mt-2 grid grid-cols-3 gap-2">
            <div>
              <dt className="text-[10px] text-[var(--color-text-muted)]">Win rate</dt>
              <dd className="text-[12px] font-semibold tabular-nums text-[var(--color-text-primary)]">{formatPct(insight.win_rate)}</dd>
            </div>
            <div>
              <dt className="text-[10px] text-[var(--color-text-muted)]">Net P&L</dt>
              <dd className={`text-[12px] font-semibold tabular-nums ${pnlClass(insight.pnl)}`}>
                {insight.pnl == null ? "—" : compactMoney(insight.pnl, currencySymbol, true)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-[var(--color-text-muted)]">Trades</dt>
              <dd className="text-[12px] font-semibold tabular-nums text-[var(--color-text-primary)]">{insight.trades}</dd>
            </div>
            {extra?.map((item) => (
              <div key={item.label}>
                <dt className="text-[10px] text-[var(--color-text-muted)]">{item.label}</dt>
                <dd className="truncate text-[12px] font-semibold text-[var(--color-text-primary)]" title={item.value}>
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </article>
  );
}

function RankList({ title, rows, currencySymbol }: { title: string; rows: NamedPerformance[]; currencySymbol: string }) {
  if (rows.length === 0) return null;
  return (
    <div className="min-w-0">
      <h4 className="mb-2 text-[12px] font-semibold text-[var(--color-text-primary)]">{title}</h4>
      <ul className="space-y-1.5">
        {rows.slice(0, 5).map((row) => (
          <li key={row.name} className="flex items-center justify-between gap-3 text-[12px]">
            <span className="truncate text-[var(--color-text-primary)]" title={row.name}>
              {row.name}
            </span>
            <span className="shrink-0 tabular-nums text-[var(--color-text-muted)]">
              {formatPct(row.win_rate)} · {tradeLabel(row.trades)} ·{" "}
              <span className={pnlClass(row.pnl)}>{row.pnl == null ? "—" : compactMoney(row.pnl, currencySymbol, true)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TradingInsights({
  data,
  currencySymbol,
  formatMoney,
}: {
  data: DashboardPerformance;
  currencySymbol: string;
  formatMoney: MoneyFormat;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const insights = data.insights;
  const mistake = insights.most_common_mistake;

  return (
    <section className="dash-card flex min-w-0 flex-col p-3.5" aria-labelledby="performance-insights-title">
      <div className="mb-3 flex h-7 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <h3 id="performance-insights-title" className="truncate text-[15px] font-bold text-[var(--color-text-primary)]">
            {t("dashboard.performanceInsights")}
          </h3>
          <InfoTooltip content={t("dashboard.hint.performanceInsights")} label={t("dashboard.performanceInsights")} />
        </div>
        <button
          type="button"
          className="shrink-0 text-[12px] font-semibold text-primary hover:underline"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? t("dashboard.hideDetailed") : t("dashboard.viewDetailed")}
        </button>
      </div>
      {!data.has_trades ? (
        <AnalyticsEmpty title={t("dashboard.empty.title")} body={t("dashboard.empty.insights")} />
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <InsightTile label="Best performing strategy" insight={insights.best_strategy} currencySymbol={currencySymbol} empty="No strategy is tagged on these trades." />
            <InsightTile label="Best trading session" insight={insights.best_session} currencySymbol={currencySymbol} empty="No session is tagged on these trades." />
            <InsightTile label="Best timeframe" insight={insights.best_timeframe} currencySymbol={currencySymbol} empty="No timeframe is tagged on these trades." />
            <InsightTile
              label="Most common mistake"
              insight={mistake ? { ...mistake, name: mistake.name } : null}
              currencySymbol={currencySymbol}
              extra={mistake ? [{ label: "Times", value: String(mistake.occurrences) }] : undefined}
              empty="No broken rules or mistakes are marked on these trades."
            />
            <InsightTile label="Best entry condition" insight={insights.best_entry} currencySymbol={currencySymbol} empty="No entry condition is tagged on these trades." />
            <InsightTile label="Best exit condition" insight={insights.best_exit} currencySymbol={currencySymbol} empty="No exit condition is tagged on these trades." />
          </div>
          {open ? (
            <div className="mt-4 space-y-4 border-t border-[var(--color-border)] pt-4">
              {insights.sides.length > 0 ? (
                <div>
                  <h4 className="mb-2 text-[12px] font-semibold text-[var(--color-text-primary)]">Trade type performance</h4>
                  <ul className="space-y-2">
                    {insights.sides.map((side) => (
                      <li key={side.name}>
                        <div className="mb-1 flex items-center justify-between gap-3 text-[12px]">
                          <span className="font-medium text-[var(--color-text-primary)]">{side.name}</span>
                          <span className="tabular-nums text-[var(--color-text-muted)]">
                            {formatPct(side.win_rate)} · {tradeLabel(side.trades)} ·{" "}
                            <span className={pnlClass(side.pnl)}>
                              {side.pnl == null ? "—" : compactMoney(side.pnl, currencySymbol, true)}
                            </span>
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-gauge-track)]">
                          <div
                            className="h-full rounded-full bg-[#2F9E6A]"
                            style={{ width: `${Math.max(0, Math.min(100, side.win_rate ?? 0))}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                  {insights.trade_types.length > 0 ? (
                    <div className="mt-3">
                      <RankList title="Tagged trade types" rows={insights.trade_types} currencySymbol={currencySymbol} />
                    </div>
                  ) : null}
                </div>
              ) : null}
              {insights.moods.length > 0 ? (
                <div className="overflow-x-auto">
                  <h4 className="mb-1 text-[12px] font-semibold text-[var(--color-text-primary)]">Mood and results</h4>
                  <p className="mb-2 text-[10px] leading-4 text-[var(--color-text-muted)]">
                    How trades tagged with each mood closed. This is a trading statistic, not a read on mood itself.
                  </p>
                  <table className="w-full min-w-[420px] text-left text-[12px]">
                    <thead className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
                      <tr>
                        <th className="py-1 font-semibold">Mood</th>
                        <th className="py-1 font-semibold">Trades</th>
                        <th className="py-1 font-semibold">Win rate</th>
                        <th className="py-1 text-right font-semibold">Net P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {insights.moods.map((mood) => (
                        <tr key={mood.name} className="border-t border-[var(--color-border)]">
                          <td className="max-w-[180px] truncate py-1.5 font-medium text-[var(--color-text-primary)]">{mood.name}</td>
                          <td className="py-1.5 tabular-nums">{mood.trades}</td>
                          <td className="py-1.5 tabular-nums">{formatPct(mood.win_rate)}</td>
                          <td className={`py-1.5 text-right tabular-nums ${pnlClass(mood.pnl)}`}>
                            {mood.pnl == null ? "—" : compactMoney(mood.pnl, currencySymbol, true)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-[12px] text-[var(--color-text-muted)]">No mood is tagged on these trades.</p>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <RankList title="Sessions" rows={insights.sessions} currencySymbol={currencySymbol} />
                <RankList title="Timeframes" rows={insights.timeframes} currencySymbol={currencySymbol} />
                <RankList title="Entry conditions" rows={insights.entries} currencySymbol={currencySymbol} />
                <RankList title="Exit conditions" rows={insights.exits} currencySymbol={currencySymbol} />
              </div>
              {insights.went_well.length > 0 ? (
                <RankList title="What went well" rows={insights.went_well} currencySymbol={currencySymbol} />
              ) : (
                <p className="text-[12px] text-[var(--color-text-muted)]">No “what went well” tags on these trades.</p>
              )}
              <div className="dash-insight-charts">
                {insightChartSources(data).map((chart) => (
                  <InsightChartBoundary key={chart.id} title={chart.title} resetKey={`${chart.id}:${chart.rows.length}`}>
                    <InsightBarChart
                      title={chart.title}
                      rows={chart.rows}
                      metrics={insightMetricConfig[chart.id].map((id) => INSIGHT_METRICS[id])}
                      currencySymbol={currencySymbol}
                      formatMoney={formatMoney}
                    />
                  </InsightChartBoundary>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
