"use client";

import clsx from "clsx";
import { Copy, FileText, Play, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DaySparkline } from "@/components/dayview/DaySparkline";
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
};

export function DayCard({ row, formatMoney, trades }: Props) {
  const { t } = useLocale();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(true);
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
    <article id={`day-${row.id}`} className="overflow-hidden rounded-md border border-border bg-surface">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left hover:bg-[var(--color-primary-very-light)]"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">{row.title}</span>
        <span className={clsx("text-[13px] font-semibold tabular-nums", pnl >= 0 ? "text-positive" : "text-negative")}>
          {t("dayView.netPnl")} {formatMoney(pnl, { signed: true, digits: 2 })}
        </span>
      </button>

      {open ? (
        <div className="border-t border-border px-3 py-2">
          <div className="flex items-start gap-3">
            <DaySparkline values={row.curve ?? [0, pnl]} className="hidden h-[64px] w-[100px] max-w-none shrink-0 sm:block" />
            <div className="min-w-0 flex-1 overflow-x-auto">
              <div className="flex min-w-[520px] items-start justify-between gap-3">
                <Stat label={t("dayView.totalTrades")} value={String(row.trades)} />
                <Stat label={t("dayView.winRate")} value={`${row.win_rate.toFixed(0)}%`} />
                <Stat
                  label={t("dayView.grossPnl")}
                  value={formatMoney(Number(row.gross_pnl ?? row.pnl), { signed: true, digits: 2 })}
                  tone={Number(row.gross_pnl ?? row.pnl) >= 0 ? "pos" : "neg"}
                />
                <Stat
                  label={t("dayView.volume")}
                  value={(row.volume ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                />
                <Stat label={t("dayView.winnersLosers")} value={`${row.winners ?? 0} / ${row.losers ?? 0}`} />
                <Stat label={t("dayView.profitFactor")} value={(row.profit_factor ?? 0).toFixed(2)} />
                <Stat label={t("dayView.commissions")} value={formatMoney(Number(row.commissions ?? 0), { digits: 2 })} />
              </div>
            </div>
            <div className="hidden w-[132px] shrink-0 flex-col gap-1 lg:flex">
              <Action icon={Sparkles} label={t("dayView.reviewCoach")} onClick={() => router.push("/coach")} />
              <Action icon={Play} label={t("dayView.replay")} onClick={() => router.push("/backtest")} />
              <Action icon={FileText} label={t("dayView.addNote")} onClick={() => router.push(`/diary?date=${row.date.slice(0, 10)}`)} />
              <Action icon={Copy} label={t("dayView.share")} onClick={() => void copySummary()} />
            </div>
          </div>

          {trades.length > 0 ? (
            <div className="mt-2 overflow-hidden rounded border border-border">
              {trades.map((trade, i) => {
                const net = Number(trade.pnl ?? 0);
                return (
                  <button
                    key={trade.id}
                    type="button"
                    className={clsx(
                      "flex w-full items-center gap-2 px-2 py-1 text-left text-[11px] hover:bg-[var(--color-primary-very-light)]",
                      i > 0 && "border-t border-border",
                    )}
                    onClick={() => router.push(`/trades/${trade.id}`)}
                  >
                    <span className="w-10 shrink-0 font-medium text-[var(--color-text-primary)]">{trade.symbol}</span>
                    <span className={clsx("w-8 shrink-0 uppercase", trade.side === "long" ? "text-positive" : "text-negative")}>
                      {trade.side === "long" ? "L" : "S"}
                    </span>
                    <span className="hidden text-[var(--color-text-tertiary)] sm:inline">{trade.opened_at.slice(11, 16)}</span>
                    <span className="ml-auto font-medium tabular-nums text-[var(--color-text-tertiary)]">
                      {trade.quantity} @ {trade.entry_price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                    <span className={clsx("w-[72px] text-right font-semibold tabular-nums", net >= 0 ? "text-positive" : "text-negative")}>
                      {formatMoney(net, { signed: true, digits: 2 })}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="mt-2 grid grid-cols-2 gap-1 lg:hidden">
            <Action icon={Sparkles} label={t("dayView.reviewCoach")} onClick={() => router.push("/coach")} />
            <Action icon={Play} label={t("dayView.replay")} onClick={() => router.push("/backtest")} />
            <Action icon={FileText} label={t("dayView.addNote")} onClick={() => router.push(`/diary?date=${row.date.slice(0, 10)}`)} />
            <Action icon={Copy} label={t("dayView.share")} onClick={() => void copySummary()} />
          </div>
        </div>
      ) : null}
    </article>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-tertiary)]">{label}</p>
      <p
        className={clsx(
          "mt-0.5 text-[13px] font-semibold tabular-nums text-[var(--color-text-primary)]",
          tone === "pos" && "text-positive",
          tone === "neg" && "text-negative",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Action({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Sparkles;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="inline-flex h-7 items-center gap-1.5 rounded border border-border bg-surface px-2 text-[11px] font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-primary-very-light)]"
    >
      <Icon className="h-3 w-3 shrink-0 text-primary" />
      <span className="truncate">{label}</span>
    </button>
  );
}
