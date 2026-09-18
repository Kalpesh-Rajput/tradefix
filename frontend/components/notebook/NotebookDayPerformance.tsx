"use client";

import { PnLChart } from "@/components/dayview/PnLChart";
import { formatNetPnl, pnlHex } from "@/components/dayview/pnlStyle";
import type { CalendarDay } from "@/lib/types";

export function NotebookDayPerformance({
  day,
  formatMoney,
}: {
  day?: CalendarDay;
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
}) {
  const pnl = Number(day?.pnl ?? 0);
  const trades = day?.trades ?? 0;
  const curve = day?.curve?.length ? day.curve : [0, pnl];

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <PnLChart values={curve} formatMoney={formatMoney} className="h-[72px] w-full min-w-0 sm:h-[88px] sm:w-[38%] sm:max-w-[240px] sm:shrink-0" />
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4 sm:gap-x-6 sm:gap-y-3">
          <Metric label="Total trades" value={String(trades)} />
          <Metric label="Winners" value={day?.winners == null ? "--" : String(day.winners)} />
          <Metric
            label="Gross P&L"
            value={
              day?.gross_pnl == null && !day
                ? "--"
                : formatNetPnl(Number(day?.gross_pnl ?? pnl), formatMoney)
            }
            color={pnlHex(Number(day?.gross_pnl ?? pnl))}
          />
          <Metric
            label="Commissions"
            value={
              day?.commissions == null
                ? "--"
                : formatMoney(Number(day.commissions), { signed: false, digits: 0 })
            }
          />
          <Metric label="Winrate" value={day ? `${Math.round(day.win_rate)}%` : "--"} />
          <Metric label="Losers" value={day?.losers == null ? "--" : String(day.losers)} />
          <Metric
            label="Volume"
            value={
              day?.volume == null
                ? "--"
                : day.volume.toLocaleString(undefined, { maximumFractionDigits: 2 })
            }
          />
          <Metric
            label="Profit factor"
            value={day?.profit_factor == null ? "--" : day.profit_factor.toFixed(2)}
          />
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium text-[var(--color-text-muted)]">{label}</p>
      <p
        className="mt-0.5 truncate text-[13px] font-semibold tabular-nums text-[var(--color-text-primary)]"
        style={color ? { color } : undefined}
      >
        {value}
      </p>
    </div>
  );
}
