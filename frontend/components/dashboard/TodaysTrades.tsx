"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

import { useAddTradeModal } from "@/components/trade/useAddTradeModal";
import { fmtMoney } from "@/lib/format";
import { Trade } from "@/lib/types";

export function TodaysTrades({ trades }: { trades: Trade[] }) {
  const { openModal } = useAddTradeModal();

  if (trades.length === 0) return null;

  const total = trades.reduce((s, t) => s + (t.pnl ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs uppercase tracking-wider text-zinc-500">Today&apos;s Trades</h3>
          <p className="mt-0.5 font-mono text-sm text-zinc-400">
            {trades.length} trade{trades.length === 1 ? "" : "s"} ·{" "}
            <span className={total >= 0 ? "text-primary" : "text-destructive"}>{fmtMoney(total)}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => openModal("manual")}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-zinc-400 transition hover:border-primary/40 hover:text-primary"
        >
          <Plus className="h-3.5 w-3.5" />
          Add another
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/[0.06]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/[0.06] bg-white/[0.02] text-[10px] uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Symbol</th>
              <th className="px-4 py-2.5 font-medium">Side</th>
              <th className="px-4 py-2.5 font-medium">Qty</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 text-right font-medium">P&L</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {trades.map((t) => (
              <tr key={t.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <Link href={`/journal/${t.id}`} className="font-mono font-medium text-white hover:text-primary">
                    {t.symbol}
                  </Link>
                  {t.setup_tag && <div className="text-[10px] text-zinc-600">{t.setup_tag}</div>}
                </td>
                <td className="px-4 py-3 capitalize text-zinc-400">{t.side}</td>
                <td className="px-4 py-3 font-mono text-zinc-400">{t.quantity}</td>
                <td className="px-4 py-3 capitalize text-zinc-500">{t.status}</td>
                <td
                  className={`px-4 py-3 text-right font-mono ${
                    (t.pnl ?? 0) > 0 ? "text-primary" : (t.pnl ?? 0) < 0 ? "text-destructive" : "text-zinc-500"
                  }`}
                >
                  {t.pnl == null ? "—" : fmtMoney(t.pnl)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
