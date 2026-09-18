"use client";

import { useState } from "react";

import { DailyStats } from "@/components/dayview/DailyStats";
import { DayCardHeader } from "@/components/dayview/DayCardHeader";
import { DayTradesTable } from "@/components/dayview/DayTradesTable";
import { PnLChart } from "@/components/dayview/PnLChart";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useToast } from "@/components/ui/Toast";
import type { CalendarDay, Trade } from "@/lib/types";

export type DayViewRow = CalendarDay & {
  id: string;
  title: string;
};

type Props = {
  row: DayViewRow;
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
  trades: Trade[];
  onAddNote: () => void;
  defaultTradesOpen?: boolean;
};

export function DayCard({ row, formatMoney, trades, onAddNote, defaultTradesOpen = false }: Props) {
  const { t } = useLocale();
  const toast = useToast();
  const [tradesOpen, setTradesOpen] = useState(defaultTradesOpen);
  const pnl = Number(row.pnl);
  const summary = `${row.title} · ${trades.length} trades · ${formatMoney(pnl, { signed: true, digits: 2 })}`;

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summary);
      toast.success(t("dayView.copied"));
    } catch {
      toast.error(t("common.error"));
    }
  }

  return (
    <article
      id={`day-${row.id}`}
      className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]"
    >
      <DayCardHeader
        title={row.title}
        pnl={pnl}
        open={tradesOpen}
        onToggle={() => setTradesOpen((v) => !v)}
        formatMoney={formatMoney}
        onReview={onAddNote}
        onAddNote={onAddNote}
        onMore={() => void copySummary()}
      />

      <div className="px-5 pb-5">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <PnLChart values={row.curve ?? [0, pnl]} formatMoney={formatMoney} />
          <DailyStats row={row} formatMoney={formatMoney} />
        </div>
        {tradesOpen ? <DayTradesTable trades={trades} formatMoney={formatMoney} /> : null}
      </div>
    </article>
  );
}
