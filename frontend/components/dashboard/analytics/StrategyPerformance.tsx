"use client";

import { useMemo, useState } from "react";

import { ChartCard } from "@/components/dashboard/zella/ChartCard";
import { CompactSelect } from "@/components/reports/CompactSelect";
import { useLocale } from "@/components/providers/LocaleProvider";
import type { DashboardPerformance, StrategyPerformanceRow } from "@/lib/types";

import {
  AnalyticsEmpty,
  BAR_PROFIT_HEX,
  compactMoney,
  formatPct,
  pnlClass,
  tradeLabel,
  type MoneyFormat,
} from "./shared";

type StrategySort = "win_rate" | "pnl" | "trades" | "profit_factor";

const SORTS: { id: StrategySort; label: string }[] = [
  { id: "win_rate", label: "Win rate" },
  { id: "pnl", label: "Net P&L" },
  { id: "trades", label: "Trades" },
  { id: "profit_factor", label: "Profit factor" },
];

function sortRows(rows: StrategyPerformanceRow[], sort: StrategySort): StrategyPerformanceRow[] {
  return [...rows].sort((a, b) => {
    const value = (row: StrategyPerformanceRow) => {
      if (sort === "win_rate") return row.win_rate ?? -1;
      if (sort === "pnl") return row.pnl ?? 0;
      if (sort === "trades") return row.trades;
      return row.profit_factor ?? -1;
    };
    return value(b) - value(a);
  });
}

export function StrategyPerformance({
  data,
  formatMoney,
  currencySymbol,
}: {
  data: DashboardPerformance;
  formatMoney: MoneyFormat;
  currencySymbol: string;
}) {
  const { t } = useLocale();
  const [sort, setSort] = useState<StrategySort>("pnl");
  const rows = useMemo(() => sortRows(data.strategies, sort), [data.strategies, sort]);

  return (
    <ChartCard
      className="!h-auto !min-h-min !p-3 [&>div:first-child]:mb-1"
      title={t("dashboard.strategyPerformance")}
      hint={t("dashboard.hint.strategyPerformance")}
      headerRight={
        <CompactSelect value={sort} options={SORTS} onChange={setSort} ariaLabel="Sort strategies" width={132} />
      }
    >
      {!data.has_trades || rows.length === 0 ? (
        <AnalyticsEmpty title={t("dashboard.empty.title")} body={t("dashboard.empty.strategy")} />
      ) : (
        <ul
          className="dash-pane-scroll max-h-[16.5rem] space-y-2"
          tabIndex={rows.length > 4 ? 0 : undefined}
          aria-label={t("dashboard.strategyPerformance")}
        >
          {rows.map((row) => (
            <li key={row.id} className="min-w-0">
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <p className="truncate text-[13px] font-semibold text-[var(--color-text-primary)]" title={row.name}>
                  {row.name}
                </p>
                <p className={`shrink-0 text-[12px] font-semibold tabular-nums ${pnlClass(row.pnl)}`}>
                  {row.pnl == null ? "—" : compactMoney(row.pnl, currencySymbol, true)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--color-gauge-track)]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(0, Math.min(100, row.win_rate ?? 0))}%`,
                      background: BAR_PROFIT_HEX,
                    }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-[11px] font-semibold tabular-nums text-[var(--color-text-primary)]">
                  {formatPct(row.win_rate)}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                {tradeLabel(row.trades)}
                {" · "}
                avg {row.avg_pnl == null ? "—" : compactMoney(row.avg_pnl, currencySymbol, true)}
                {" · "}
                PF {row.profit_factor == null ? "—" : row.profit_factor.toFixed(2)}
                <span className="sr-only">{formatMoney(row.pnl ?? 0, { signed: true, digits: 2 })}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  );
}
