"use client";

import { ChevronDown, ChevronRight } from "lucide-react";

import { DayActions } from "@/components/dayview/DayActions";
import { formatNetPnl, pnlHex } from "@/components/dayview/pnlStyle";
import { useLocale } from "@/components/providers/LocaleProvider";

export function DayCardHeader({
  title,
  pnl,
  open,
  onToggle,
  formatMoney,
  onReview,
  onAddNote,
  onMore,
}: {
  title: string;
  pnl: number;
  open: boolean;
  onToggle: () => void;
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
  onReview: () => void;
  onAddNote: () => void;
  onMore: () => void;
}) {
  const { t } = useLocale();
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? t("dayView.hideTrades") : t("dayView.showTrades")}
        className="flex min-w-0 items-center gap-2 text-left"
      >
        <Chevron className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" strokeWidth={2} />
        <span className="truncate text-[14px] font-semibold text-[var(--color-text-primary)]">{title}</span>
        <span className="shrink-0 text-[13px] font-semibold tabular-nums" style={{ color: pnlHex(pnl) }}>
          {t("dayView.netPnl")} {formatNetPnl(pnl, formatMoney)}
        </span>
      </button>
      <DayActions onReview={onReview} onAddNote={onAddNote} onMore={onMore} />
    </div>
  );
}
