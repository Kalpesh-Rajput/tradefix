"use client";

import type { ReactNode } from "react";
import { Award, Flame, TrendingDown, TrendingUp } from "lucide-react";

import type { GroupBucket, GroupSummary } from "@/lib/reports/group";
import type { ReportCardCopy } from "@/lib/reports/catalog";
import { formatMetricValue } from "@/lib/reports/format";
import type { MoneyFormatter } from "@/lib/reports/types";

function tradeLabel(count: number) {
  return `${count} ${count === 1 ? "trade" : "trades"}`;
}

export function ReportSummaryCards({
  summary,
  copy,
  formatMoney,
  winRateAsPrimary = false,
}: {
  summary: GroupSummary;
  copy: ReportCardCopy;
  formatMoney: MoneyFormatter;
  winRateAsPrimary?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard
        icon={<TrendingUp className="h-3.5 w-3.5" style={{ color: "#2F9E6A" }} />}
        title={copy.best}
        bucket={summary.best}
        formatMoney={formatMoney}
        showPnl
      />
      <SummaryCard
        icon={<TrendingDown className="h-3.5 w-3.5" style={{ color: "#D64545" }} />}
        title={copy.least}
        bucket={summary.least}
        formatMoney={formatMoney}
        showPnl
      />
      <SummaryCard
        icon={<Flame className="h-3.5 w-3.5 text-amber-500" />}
        title={copy.mostActive}
        bucket={summary.mostActive}
        formatMoney={formatMoney}
      />
      <SummaryCard
        icon={<Award className="h-3.5 w-3.5" style={{ color: "#2F9E6A" }} />}
        title={copy.bestWinRate}
        bucket={summary.bestWinRate}
        formatMoney={formatMoney}
        winRate
        winRateAsPrimary={winRateAsPrimary}
      />
    </div>
  );
}

function SummaryCard({
  icon,
  title,
  bucket,
  formatMoney,
  showPnl = false,
  winRate = false,
  winRateAsPrimary = false,
}: {
  icon: ReactNode;
  title: string;
  bucket: GroupBucket | null;
  formatMoney: MoneyFormatter;
  showPnl?: boolean;
  winRate?: boolean;
  winRateAsPrimary?: boolean;
}) {
  const empty = !bucket;
  const pnl = bucket?.pnl ?? 0;
  const pnlTone = pnl < 0 ? "text-[#D64545]" : pnl > 0 ? "text-[#2F9E6A]" : "text-[var(--color-text-secondary)]";
  const pnlBg =
    pnl < 0
      ? "bg-[var(--color-danger-bg)]"
      : pnl > 0
        ? "bg-[var(--color-success-light)]"
        : "bg-[var(--color-surface-secondary)]";

  return (
    <article className="dash-card flex h-full min-w-0 flex-col p-3.5">
      <div className="flex h-5 items-center gap-1.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
        {icon}
        <span className="truncate">{title}</span>
      </div>
      <p className="mt-2 truncate text-[18px] font-semibold tracking-tight text-[var(--color-text-primary)]">
        {empty ? "—" : winRate && winRateAsPrimary ? `${bucket.winRate.toFixed(bucket.winRate % 1 ? 2 : 0)}%` : bucket.fullLabel}
      </p>
      <div className="mt-auto flex min-h-[28px] items-end justify-between gap-2 pt-2 text-[12px]">
        {empty ? (
          <span className="text-[var(--color-text-muted)]">No trades</span>
        ) : winRate ? (
          <span className="text-[var(--color-text-secondary)]">
            {bucket.winRate.toFixed(bucket.winRate % 1 ? 2 : 0)}% / {tradeLabel(bucket.trades)}
          </span>
        ) : (
          <>
            <span className="text-[var(--color-text-muted)]">{tradeLabel(bucket.trades)}</span>
            {showPnl ? (
              <span className={`rounded px-1.5 py-0.5 tabular-nums ${pnlTone} ${pnlBg}`}>
                {formatMetricValue(pnl, "currency", formatMoney)}
              </span>
            ) : null}
          </>
        )}
      </div>
    </article>
  );
}
