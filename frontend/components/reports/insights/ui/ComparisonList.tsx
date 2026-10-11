"use client";

import { PNL_LOSS_HEX, PNL_PROFIT_HEX } from "@/lib/appearance";
import { fmtPct, pnlColor } from "@/lib/reports/advanced/format";
import type { LabelComparison } from "@/lib/reports/advanced/types";
import type { MoneyFormatter } from "@/lib/reports/types";

import { useDrill } from "../DrillContext";
import { EvidenceBadge } from "./Badges";
import { InsufficientState } from "./InsightCard";

export function ComparisonList({
  block,
  dimension,
  drillTitle,
  formatMoney,
  emptyReason,
  height,
}: {
  block: LabelComparison;
  dimension: string;
  drillTitle: (label: string) => string;
  formatMoney: MoneyFormatter;
  emptyReason: string;
  height: number;
}) {
  const drill = useDrill();
  const rows = block.rows;
  const maxDiff = Math.max(1, ...rows.map((r) => Math.abs(r.diff ?? 0)));

  if (!rows.length) return <InsufficientState reason={emptyReason} height={height} />;

  return (
    <div className="flex flex-col" style={{ height }}>
      <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] gap-2 border-b border-[var(--color-border)] pb-1.5 text-[10px] font-medium text-[var(--color-text-muted)]">
        <span>Label · trades</span>
        <span>Avg P&L with vs without</span>
        <span className="w-[112px] text-right">Evidence</span>
      </div>
      <ul className="min-h-0 flex-1 divide-y divide-[var(--color-border-subtle)] overflow-y-auto">
        {rows.map((r) => {
          const diff = r.diff ?? 0;
          const w = (Math.abs(diff) / maxDiff) * 50;
          return (
            <li key={r.key}>
              <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] items-center gap-2 py-2">
                <button
                  type="button"
                  onClick={() => drill({ dimension, key: r.key }, drillTitle(r.label))}
                  className="min-w-0 text-left outline-none focus-visible:underline"
                >
                  <span className="block truncate text-[12px] font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-primary)]">
                    {r.label}
                  </span>
                  <span className="block text-[10px] tabular-nums text-[var(--color-text-muted)]">
                    {r.trades} trades · {fmtPct(r.win_rate, 0)} win vs {fmtPct(r.win_rate_without, 0)}
                  </span>
                </button>
                <div className="min-w-0">
                  <div className="flex items-baseline justify-between gap-1 text-[10.5px] tabular-nums">
                    <span className="font-semibold" style={{ color: pnlColor(r.avg_with) }}>
                      {r.avg_with != null ? formatMoney(r.avg_with) : "—"}
                    </span>
                    <span className="text-[var(--color-text-muted)]">vs {r.avg_without != null ? formatMoney(r.avg_without) : "—"}</span>
                  </div>
                  <div className="relative mt-1 h-1.5 rounded-full bg-[var(--color-gauge-track)]">
                    <span className="absolute left-1/2 top-[-2px] h-[10px] w-px bg-[var(--color-border)]" aria-hidden />
                    <span
                      className="absolute top-0 h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${w}%`,
                        left: diff >= 0 ? "50%" : `${50 - w}%`,
                        background: diff >= 0 ? PNL_PROFIT_HEX : PNL_LOSS_HEX,
                      }}
                    />
                  </div>
                </div>
                <div className="flex w-[112px] justify-end">
                  <EvidenceBadge evidence={r.evidence} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-1.5 text-[10px] leading-snug text-[var(--color-text-muted)]">
        {block.note} {block.multi_label_trades ? `${block.overlap_note} (${fmtPct(block.overlap_pct, 0)} of labelled trades carry more than one.)` : ""}
        {block.unlabelled_trades ? ` ${block.unlabelled_trades} trades have no label.` : ""}
      </p>
    </div>
  );
}
