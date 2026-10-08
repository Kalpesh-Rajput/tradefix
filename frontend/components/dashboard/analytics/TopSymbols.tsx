"use client";

import { useMemo, useState } from "react";

import { ChartCard } from "@/components/dashboard/zella/ChartCard";
import { CompactSelect } from "@/components/reports/CompactSelect";
import { useLocale } from "@/components/providers/LocaleProvider";
import type { DashboardPerformance, SymbolPerformanceRow } from "@/lib/types";

import { AnalyticsEmpty, compactMoney, formatPct, pnlClass, tradeLabel, type MoneyFormat } from "./shared";

type SymbolSort = "pnl" | "win_rate" | "trades";

const SORTS: { id: SymbolSort; label: string }[] = [
  { id: "pnl", label: "Net P&L" },
  { id: "win_rate", label: "Win rate" },
  { id: "trades", label: "Trades" },
];

const RANK_CLASS = [
  "bg-[#F5A524] text-white",
  "bg-[#C5C7D0] text-[#2A2C33]",
  "bg-[#E08A3C] text-white",
  "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]",
];

function sortSymbols(rows: SymbolPerformanceRow[], sort: SymbolSort): SymbolPerformanceRow[] {
  return [...rows].sort((a, b) => {
    const value = (row: SymbolPerformanceRow) => {
      if (sort === "win_rate") return row.win_rate ?? -1;
      if (sort === "trades") return row.trades;
      return row.pnl ?? 0;
    };
    return value(b) - value(a);
  });
}

export function TopSymbols({
  data,
  currencySymbol,
  formatMoney,
}: {
  data: DashboardPerformance;
  currencySymbol: string;
  formatMoney: MoneyFormat;
}) {
  const { t } = useLocale();
  const [sort, setSort] = useState<SymbolSort>("pnl");
  const rows = useMemo(() => sortSymbols(data.symbols, sort), [data.symbols, sort]);

  return (
    <ChartCard
      className="h-full min-h-0 overflow-hidden !p-3 [&>div:first-child]:mb-1"
      title={t("dashboard.topSymbols")}
      hint={t("dashboard.hint.topSymbols")}
      headerRight={
        <CompactSelect value={sort} options={SORTS} onChange={setSort} ariaLabel="Sort symbols" width={112} />
      }
    >
      {!data.has_trades || rows.length === 0 ? (
        <AnalyticsEmpty title={t("dashboard.empty.title")} body={t("dashboard.empty.symbols")} />
      ) : (
        <ol className="dash-pane-scroll divide-y divide-[var(--color-border)]" aria-label={t("dashboard.topSymbols")}>
          {rows.map((row, index) => (
            <li key={row.symbol} className="flex items-center gap-2.5 py-1.5">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  RANK_CLASS[Math.min(index, RANK_CLASS.length - 1)]
                }`}
                aria-hidden
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold tracking-wide text-[var(--color-text-primary)]">{row.symbol}</p>
                <p className="text-[11px] text-[var(--color-text-muted)]">{tradeLabel(row.trades)}</p>
              </div>
              <div className="text-right">
                <p className={`text-[13px] font-bold tabular-nums ${pnlClass(row.pnl)}`} title={formatMoney(row.pnl ?? 0, { signed: true, digits: 2 })}>
                  {row.pnl == null ? "—" : compactMoney(row.pnl, currencySymbol, true)}
                </p>
                <p className="text-[11px] tabular-nums text-[var(--color-text-muted)]">{formatPct(row.win_rate)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </ChartCard>
  );
}
