"use client";

import Link from "next/link";

import type { AiInsightWeekly } from "@/lib/types";

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] text-[var(--color-text-tertiary)]">{label}</p>
      <p className="truncate text-[12px] font-medium text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}

export function WeeklyCard({
  weekly,
  formatMoney,
}: {
  weekly: AiInsightWeekly;
  formatMoney: (n: number, opts?: { signed?: boolean }) => string;
}) {
  const performance =
    weekly.performance_r != null
      ? `${weekly.performance_r > 0 ? "+" : ""}${weekly.performance_r.toFixed(1)}R`
      : formatMoney(weekly.pnl, { signed: true });

  return (
    <section className="dash-card p-3.5 sm:p-4">
      <div className="flex h-6 items-center justify-between gap-2">
        <h2 className="text-[12px] font-medium text-[var(--color-text-primary)]">Your Trading Week</h2>
        <Link href="/ai-review" className="text-[11px] font-medium text-primary hover:underline">
          View Full AI Review
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Cell label="Performance" value={performance} />
        <Cell label="Best Setup" value={weekly.best_setup || "—"} />
        <Cell label="Biggest Leak" value={weekly.biggest_leak || "—"} />
        <Cell label="Best Session" value={weekly.best_session || "—"} />
        <Cell
          label="Rule Adherence"
          value={weekly.rule_adherence != null ? `${weekly.rule_adherence.toFixed(0)}%` : "—"}
        />
        <Cell label="Biggest Improvement" value={weekly.biggest_improvement || "—"} />
        <Cell label="Main Focus" value={weekly.main_focus || "—"} />
        <Cell label="Trades" value={String(weekly.trades)} />
      </div>
    </section>
  );
}
