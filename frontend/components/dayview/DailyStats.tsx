"use client";

import { useLocale } from "@/components/providers/LocaleProvider";

type StatsSource = {
  trades: number;
  pnl: number;
  win_rate: number;
  gross_pnl?: number;
  volume?: number;
  winners?: number;
  losers?: number;
  profit_factor?: number;
  commissions?: number;
};

export function DailyStats({
  row,
  formatMoney,
}: {
  row: StatsSource;
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
}) {
  const { t } = useLocale();
  const items = [
    { label: t("dayView.totalTrades"), value: String(row.trades) },
    {
      label: t("dayView.grossPnl"),
      value: formatMoney(Number(row.gross_pnl ?? row.pnl), { signed: true, digits: 0 }).replace(/^\+/, ""),
    },
    { label: t("dayView.winnersLosers"), value: `${row.winners ?? 0} / ${row.losers ?? 0}` },
    { label: t("dayView.commissions"), value: formatMoney(Number(row.commissions ?? 0), { signed: false, digits: 0 }) },
    { label: t("dayView.winRate"), value: `${Math.round(row.win_rate)}%` },
    {
      label: t("dayView.volume"),
      value: (row.volume ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 }),
    },
    { label: t("dayView.profitFactor"), value: (row.profit_factor ?? 0).toFixed(2) },
  ];

  return (
    <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4 sm:pt-2">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{item.label}</p>
          <p className="mt-1 truncate text-[15px] font-semibold tabular-nums text-[var(--color-text-primary)]">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
