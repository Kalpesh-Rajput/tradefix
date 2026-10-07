"use client";

import { useState } from "react";

import { ChartCard } from "@/components/dashboard/zella/ChartCard";
import { useLocale } from "@/components/providers/LocaleProvider";
import type { DashboardPerformance, PerformanceCounts } from "@/lib/types";

import { AnalyticsEmpty, compactMoney, formatPct, tradeLabel, type MoneyFormat } from "./shared";

type YearMetric = "pnl" | "win_rate" | "trades";

const METRICS: { id: YearMetric; label: string }[] = [
  { id: "pnl", label: "Net P&L" },
  { id: "win_rate", label: "Win Rate" },
  { id: "trades", label: "Trades" },
];

function cellValue(metric: YearMetric, row: PerformanceCounts, symbol: string): string {
  if (!row.trades) return "—";
  if (metric === "pnl") return compactMoney(row.pnl ?? 0, symbol);
  if (metric === "win_rate") return formatPct(row.win_rate);
  return String(row.trades);
}

function cellTone(metric: YearMetric, row: PerformanceCounts): "profit" | "loss" | "neutral" | "empty" {
  if (!row.trades) return "empty";
  if (metric === "trades") return "neutral";
  if (metric === "win_rate") {
    if ((row.win_rate ?? 0) >= 55) return "profit";
    if ((row.win_rate ?? 0) <= 45) return "loss";
    return "neutral";
  }
  if ((row.pnl ?? 0) > 0) return "profit";
  if ((row.pnl ?? 0) < 0) return "loss";
  return "neutral";
}

const TONE_CLASS = {
  profit: "border-transparent bg-[#2F9E6A] text-white",
  loss: "border-transparent bg-[#D64545] text-white",
  neutral: "border-[var(--color-border)] bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]",
  empty: "border-[var(--color-border)] bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)]",
} as const;

function MonthCell({
  label,
  row,
  metric,
  symbol,
  formatMoney,
  emphasize = false,
}: {
  label: string;
  row: PerformanceCounts;
  metric: YearMetric;
  symbol: string;
  formatMoney: MoneyFormat;
  emphasize?: boolean;
}) {
  const tone = cellTone(metric, row);
  const exact =
    row.trades > 0 && row.pnl != null ? formatMoney(row.pnl, { signed: true, digits: 2 }) : "No closed trades";
  return (
    <div
      className={`flex min-h-[92px] min-w-[68px] flex-col justify-between rounded-[10px] border px-2 py-2 ${TONE_CLASS[tone]} ${
        emphasize ? "ring-1 ring-[var(--color-border)]" : ""
      }`}
      title={row.trades ? `${label}: ${exact} · ${formatPct(row.win_rate)} · ${tradeLabel(row.trades)}` : `${label}: no closed trades`}
    >
      <span className={`text-[10px] font-medium ${tone === "profit" || tone === "loss" ? "text-white/80" : "text-[var(--color-text-muted)]"}`}>
        {label}
      </span>
      <span className="text-[13px] font-bold leading-4 tabular-nums">{cellValue(metric, row, symbol)}</span>
      <span className={`text-[10px] tabular-nums ${tone === "profit" || tone === "loss" ? "text-white/80" : "text-[var(--color-text-muted)]"}`}>
        {metric === "trades" || !row.trades ? (row.trades ? formatPct(row.win_rate) : "—") : tradeLabel(row.trades)}
      </span>
    </div>
  );
}

export function YearlyPerformance({
  data,
  formatMoney,
  currencySymbol,
}: {
  data: DashboardPerformance;
  formatMoney: MoneyFormat;
  currencySymbol: string;
}) {
  const { t } = useLocale();
  const [metric, setMetric] = useState<YearMetric>("pnl");
  const year = data.yearly;

  return (
    <ChartCard
      title={t("dashboard.yearlyPerformance")}
      hint={t("dashboard.hint.yearlyPerformance")}
      headerRight={
        <div role="tablist" aria-label="Yearly metric" className="inline-flex h-6 shrink-0 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-px">
          {METRICS.map((item) => {
            const active = metric === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setMetric(item.id)}
                className={`rounded-[5px] px-2 text-[10px] font-semibold transition-colors ${
                  active
                    ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      }
    >
      {!data.has_trades ? (
        <AnalyticsEmpty title={t("dashboard.empty.title")} body={t("dashboard.empty.yearly")} />
      ) : (
        <div className="min-w-0 overflow-x-auto pb-1">
          <div className="mb-2 text-[11px] font-semibold text-[var(--color-text-secondary)]">{year.year}</div>
          <div className="grid min-w-[920px] grid-cols-[repeat(12,minmax(68px,1fr))_84px] gap-2">
            {year.months.map((month) => (
              <MonthCell
                key={month.month}
                label={month.short_label}
                row={month}
                metric={metric}
                symbol={currencySymbol}
                formatMoney={formatMoney}
              />
            ))}
            <MonthCell
              label="Total"
              row={year.total}
              metric={metric}
              symbol={currencySymbol}
              formatMoney={formatMoney}
              emphasize
            />
          </div>
        </div>
      )}
    </ChartCard>
  );
}
