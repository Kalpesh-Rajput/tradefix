"use client";

import { useLocale } from "@/components/providers/LocaleProvider";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

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

function StatLabel({ label, hint, detail }: { label: string; hint: string; detail?: boolean }) {
  return (
    <p
      className={
        detail
          ? "flex items-center gap-1 text-[11px] text-[#8B8D96]"
          : "flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]"
      }
    >
      <span className="min-w-0 truncate">{label}</span>
      <InfoTooltip content={hint} label={label} />
    </p>
  );
}

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
      { label: t("dayView.totalTrades"), hint: t("dayView.hint.totalTrades"), value: String(row.trades) },
      { label: t("dayView.winners"), hint: t("dayView.hint.winners"), value: String(row.winners ?? 0) },
      { label: t("dayView.winRate"), hint: t("dayView.hint.winRate"), value: `${Math.round(row.win_rate)}%` },
      { label: t("dayView.losers"), hint: t("dayView.hint.losers"), value: String(row.losers ?? 0) },
      {
        label: t("dayView.grossPnl"),
        hint: t("dayView.hint.grossPnl"),
        value: formatMoney(Number(row.gross_pnl ?? row.pnl), { signed: true, digits: 0 }).replace(/^\+/, ""),
      },
      {
        label: t("dayView.volume"),
        hint: t("dayView.hint.volume"),
        value: (row.volume ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 }),
      },
      {
        label: t("dayView.commissions"),
        hint: t("dayView.hint.commissions"),
        value: formatMoney(Number(row.commissions ?? 0), { signed: false, digits: 0 }),
      },
      { label: t("dayView.profitFactor"), hint: t("dayView.hint.profitFactor"), value: formatFactor(row.profit_factor) },
    ];

    return (
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="min-w-0">
            <StatLabel label={item.label} hint={item.hint} detail />
            <p className="mt-1 truncate text-[15px] font-semibold tabular-nums text-[#1F2128]">{item.value}</p>
          </div>
        ))}
      </div>
    );
  }

  const items = [
    { label: t("dayView.totalTrades"), hint: t("dayView.hint.totalTrades"), value: String(row.trades) },
    {
      label: t("dayView.grossPnl"),
      hint: t("dayView.hint.grossPnl"),
      value: formatMoney(Number(row.gross_pnl ?? row.pnl), { signed: true, digits: 0 }).replace(/^\+/, ""),
    },
    { label: t("dayView.winnersLosers"), hint: t("dayView.hint.winnersLosers"), value: `${row.winners ?? 0} / ${row.losers ?? 0}` },
    {
      label: t("dayView.commissions"),
      hint: t("dayView.hint.commissions"),
      value: formatMoney(Number(row.commissions ?? 0), { signed: false, digits: 0 }),
    },
    { label: t("dayView.winRate"), hint: t("dayView.hint.winRate"), value: `${Math.round(row.win_rate)}%` },
    {
      label: t("dayView.volume"),
      hint: t("dayView.hint.volume"),
      value: (row.volume ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 }),
    },
    { label: t("dayView.profitFactor"), hint: t("dayView.hint.profitFactor"), value: formatFactor(row.profit_factor) },
  ];

  return (
    <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4 sm:pt-2">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <StatLabel label={item.label} hint={item.hint} />
          <p className="mt-1 truncate text-[15px] font-semibold tabular-nums text-[var(--color-text-primary)]">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
