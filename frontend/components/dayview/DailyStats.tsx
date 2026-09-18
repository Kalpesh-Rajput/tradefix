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

function formatFactor(value?: number) {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—";
  return value.toFixed(2);
}

export function DailyStats({
  row,
  formatMoney,
  variant = "default",
}: {
  row: StatsSource;
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
  variant?: "default" | "detail";
}) {
  const { t } = useLocale();

  if (variant === "detail") {
    const items = [
      { label: t("dayView.totalTrades"), value: String(row.trades) },
      { label: t("dayView.winners"), value: String(row.winners ?? 0) },
      { label: t("dayView.winRate"), value: `${Math.round(row.win_rate)}%` },
      { label: t("dayView.losers"), value: String(row.losers ?? 0) },
      {
        label: t("dayView.grossPnl"),
        value: formatMoney(Number(row.gross_pnl ?? row.pnl), { signed: true, digits: 0 }).replace(/^\+/, ""),
      },
      {
        label: t("dayView.volume"),
        value: (row.volume ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 }),
      },
      {
        label: t("dayView.commissions"),
        value: formatMoney(Number(row.commissions ?? 0), { signed: false, digits: 0 }),
      },
      { label: t("dayView.profitFactor"), value: formatFactor(row.profit_factor) },
    ];

    return (
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="min-w-0">
            <p className="text-[11px] text-[#8B8D96]">{item.label}</p>
            <p className="mt-1 truncate text-[15px] font-semibold tabular-nums text-[#1F2128]">{item.value}</p>
          </div>
        ))}
      </div>
    );
  }

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
    { label: t("dayView.profitFactor"), value: formatFactor(row.profit_factor) },
  ];

  return (
    <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4 sm:pt-2">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{item.label}</p>
          <p className="mt-1 truncate text-[15px] font-semibold tabular-nums text-[var(--color-text-primary)]">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
