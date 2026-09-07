"use client";

import clsx from "clsx";
import { Play } from "lucide-react";
import { useRouter } from "next/navigation";

import { pnlHex } from "@/components/dayview/pnlStyle";
import { useLocale } from "@/components/providers/LocaleProvider";
import type { Trade } from "@/lib/types";

export type DayTradeColumnId = "opened_at" | "symbol" | "side" | "qty_entry" | "pnl" | "replay";

export type DayTradeColumn = {
  id: DayTradeColumnId;
  label: string;
  align?: "left" | "right" | "center";
  className?: string;
};

export const DEFAULT_DAY_TRADE_COLUMNS: DayTradeColumnId[] = [
  "opened_at",
  "symbol",
  "side",
  "qty_entry",
  "pnl",
  "replay",
];

export function DayTradesTable({
  trades,
  formatMoney,
  columns = DEFAULT_DAY_TRADE_COLUMNS,
}: {
  trades: Trade[];
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
  columns?: DayTradeColumnId[];
}) {
  const { t } = useLocale();
  const router = useRouter();

  const defs: Record<DayTradeColumnId, DayTradeColumn> = {
    opened_at: { id: "opened_at", label: t("dayView.col.time"), className: "w-[88px]" },
    symbol: { id: "symbol", label: t("common.symbol"), className: "w-[100px]" },
    side: { id: "side", label: t("dayView.col.side"), className: "w-[72px]" },
    qty_entry: { id: "qty_entry", label: t("dayView.col.qtyEntry"), className: "min-w-[120px]" },
    pnl: { id: "pnl", label: t("dayView.col.pnl"), align: "right", className: "w-[100px]" },
    replay: { id: "replay", label: t("dayView.col.replay"), align: "center", className: "w-[64px]" },
  };

  const visible = columns.map((id) => defs[id]);

  if (trades.length === 0) return null;

  return (
    <div className="mt-4 overflow-x-auto rounded-md border border-[var(--color-border)]">
      <table className="w-full min-w-[640px] text-left">
        <thead>
          <tr className="bg-[var(--color-primary-very-light)] text-[11px] font-medium text-[var(--color-text-tertiary)]">
            {visible.map((col) => (
              <th
                key={col.id}
                className={clsx(
                  "h-8 px-3 font-medium",
                  col.align === "right" && "text-right",
                  col.align === "center" && "text-center",
                  col.className
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => {
            const net = Number(trade.pnl ?? 0);
            return (
              <tr
                key={trade.id}
                className="cursor-pointer border-t border-[var(--color-border-light)] bg-[var(--color-surface)] text-[12px] hover:bg-[var(--color-primary-very-light)]"
                onClick={() => router.push(`/trades/${trade.id}`)}
              >
                {visible.map((col) => (
                  <td
                    key={col.id}
                    className={clsx(
                      "h-10 px-3 align-middle",
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center"
                    )}
                  >
                    <Cell trade={trade} column={col.id} net={net} formatMoney={formatMoney} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Cell({
  trade,
  column,
  net,
  formatMoney,
}: {
  trade: Trade;
  column: DayTradeColumnId;
  net: number;
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
}) {
  if (column === "opened_at") {
    return <span className="tabular-nums text-[var(--color-text-secondary)]">{trade.opened_at.slice(11, 16)}</span>;
  }
  if (column === "symbol") {
    return (
      <span className="inline-flex rounded-md bg-[#E8EEF4] px-1.5 py-0.5 text-[11px] font-semibold text-[#3B4A5A]">
        {trade.symbol}
      </span>
    );
  }
  if (column === "side") {
    return <span className="font-medium uppercase tracking-wide text-[var(--color-text-primary)]">{trade.side}</span>;
  }
  if (column === "qty_entry") {
    return (
      <span className="tabular-nums text-[var(--color-text-secondary)]">
        {trade.quantity} @ {trade.entry_price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </span>
    );
  }
  if (column === "pnl") {
    return (
      <span className="font-semibold tabular-nums" style={{ color: pnlHex(net) }}>
        {formatMoney(net, { signed: true, digits: 2 }).replace(/^\+/, "")}
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-on-accent">
      <Play className="h-2.5 w-2.5 translate-x-[0.5px]" fill="currentColor" strokeWidth={0} />
    </span>
  );
}
