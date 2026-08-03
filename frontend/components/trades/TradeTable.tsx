import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { Trade } from "@/lib/types";

function fmtMoney(n: number | null) {
  if (n === null) return "—";
  const sign = n >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function TradeTable({ trades }: { trades: Trade[] }) {
  if (trades.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-gray-500">
        No trades yet. Log your first trade or import a CSV to get started.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2 text-left text-xs uppercase tracking-wide text-gray-500">
            <th className="px-4 py-3">Symbol</th>
            <th className="px-4 py-3">Side</th>
            <th className="px-4 py-3">Setup</th>
            <th className="px-4 py-3">Opened</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => (
            <tr key={t.id} className="border-b border-border last:border-0 hover:bg-surface-2/60">
              <td className="px-4 py-3">
                <Link href={`/journal/${t.id}`} className="font-medium text-white hover:text-gold">
                  {t.symbol}
                </Link>
              </td>
              <td className="px-4 py-3">
                <Badge tone={t.side === "long" ? "positive" : "negative"}>{t.side}</Badge>
              </td>
              <td className="px-4 py-3 text-gray-300">{t.setup_tag ?? "—"}</td>
              <td className="px-4 py-3 text-gray-400">{new Date(t.opened_at).toLocaleString()}</td>
              <td className="px-4 py-3">
                <Badge tone={t.status === "open" ? "gold" : "neutral"}>{t.status}</Badge>
              </td>
              <td
                className={`px-4 py-3 text-right font-medium ${
                  t.pnl === null ? "text-gray-500" : t.pnl >= 0 ? "text-positive" : "text-negative"
                }`}
              >
                {fmtMoney(t.pnl)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
