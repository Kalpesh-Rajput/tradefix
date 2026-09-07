"use client";

import { FileText } from "lucide-react";
import { useMemo, useState } from "react";

import { PNL_LOSS_HEX, PNL_PROFIT_HEX } from "@/lib/appearance";
import {
  executionGrossPnl,
  formatDateTime,
  sortedExecutions,
} from "@/lib/trades/previewStats";
import type { Trade, TradeExecution } from "@/lib/types";

type DisplayRow = {
  id: string;
  executed_at: string;
  price: number;
  quantity: number;
  pnl: number | null;
};

export function ExecutionsTab({
  trade,
  formatMoney,
  timeZone,
}: {
  trade: Trade;
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
  timeZone?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const rows = useMemo(() => buildRows(trade), [trade]);
  const visible = expanded ? rows : rows.slice(0, 8);
  const tzLabel = timeZone ? timeZone.replace(/_/g, " ") : "local";

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] text-[var(--color-text-secondary)]">
          {rows.length} execution{rows.length === 1 ? "" : "s"}
        </p>
        {rows.length > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
          >
            <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
            {expanded || rows.length <= 8 ? "View all" : "View all"}
          </button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-[var(--color-text-tertiary)]">
          No executions on this trade.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-[#EFEFF2]">
          <table className="w-full min-w-[360px] text-left text-[12px]">
            <thead>
              <tr className="bg-[#F6F4FA] text-[10px] font-medium uppercase tracking-wide text-[#70717A]">
                <th className="px-2 py-2 font-medium">Date/Time ({tzLabel})</th>
                <th className="px-2 py-2 font-medium">Price</th>
                <th className="px-2 py-2 font-medium">Quantity</th>
                <th className="px-2 py-2 font-medium">Gross P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const signedQty = row.quantity;
                return (
                  <tr key={row.id} className="border-t border-[#EFEFF2]">
                    <td className="whitespace-nowrap px-2 py-2 text-[var(--color-text-secondary)]">
                      {formatDateTime(row.executed_at, timeZone)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 font-mono">
                      {formatMoney(row.price, { signed: false, digits: 2 })}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                      {signedQty}
                    </td>
                    <td
                      className="whitespace-nowrap px-2 py-2 font-semibold tabular-nums"
                      style={{
                        color:
                          row.pnl == null
                            ? undefined
                            : row.pnl > 0
                              ? PNL_PROFIT_HEX
                              : row.pnl < 0
                                ? PNL_LOSS_HEX
                                : undefined,
                      }}
                    >
                      {row.pnl == null ? "—" : formatMoney(row.pnl, { signed: false, digits: 0 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function buildRows(trade: Trade): DisplayRow[] {
  const execs = sortedExecutions(trade);
  if (execs.length) {
    return execs.map((fill) => toRow(trade, fill));
  }
  const rows: DisplayRow[] = [
    {
      id: `${trade.id}-entry`,
      executed_at: trade.opened_at,
      price: Number(trade.entry_price),
      quantity: Number(trade.quantity),
      pnl: 0,
    },
  ];
  if (trade.exit_price != null && trade.closed_at) {
    const qty = Number(trade.sell_quantity ?? trade.quantity);
    rows.push({
      id: `${trade.id}-exit`,
      executed_at: trade.closed_at,
      price: Number(trade.exit_price),
      quantity: -Math.abs(qty),
      pnl: tradeGrossFromTrade(trade),
    });
  }
  return rows;
}

function toRow(trade: Trade, fill: TradeExecution): DisplayRow {
  const signed = fill.leg_type === "exit" ? -Math.abs(Number(fill.quantity)) : Number(fill.quantity);
  return {
    id: fill.id,
    executed_at: fill.executed_at,
    price: Number(fill.price),
    quantity: signed,
    pnl: executionGrossPnl(trade, fill),
  };
}

function tradeGrossFromTrade(trade: Trade): number | null {
  if (trade.pnl == null) return null;
  return Number(trade.pnl) + Number(trade.fees || 0);
}
