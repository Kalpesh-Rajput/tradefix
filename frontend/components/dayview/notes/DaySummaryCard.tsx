"use client";

import { ChevronRight } from "lucide-react";

import { formatNetPnl, pnlHex } from "@/components/dayview/pnlStyle";

export function DaySummaryCard({
  title,
  pnl,
  trades,
  winRate,
  formatMoney,
}: {
  title: string;
  pnl: number;
  trades: number;
  winRate: number;
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--color-text-primary)]">
        <ChevronRight className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" strokeWidth={2} />
        <span>{title}</span>
        <span className="text-[var(--color-text-muted)]">•</span>
        <span>
          Net P&L{" "}
          <span className="font-semibold tabular-nums" style={{ color: pnlHex(pnl) }}>
            {formatNetPnl(pnl, formatMoney)}
          </span>
        </span>
      </div>
      <p className="mt-1 pl-6 text-[12px] text-[var(--color-text-tertiary)]">
        {trades} {trades === 1 ? "trade" : "trades"} · {Math.round(winRate)}% win rate
      </p>
    </div>
  );
}
