"use client";

import Link from "next/link";

import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { Badge } from "@/components/ui/Badge";
import { Trade } from "@/lib/types";

export function TradeTable({ trades }: { trades: Trade[] }) {
  const { formatDateTime, t } = useLocale();
  const { formatMoney, displayPnl } = useAccountPrefs();

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
            <th className="px-4 py-3">{t("common.symbol")}</th>
            <th className="px-4 py-3">Side</th>
            <th className="px-4 py-3">Setup</th>
            <th className="px-4 py-3">Opened</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => {
            const pnl = displayPnl(trade.pnl, trade.fees);
            return (
              <tr key={trade.id} className="border-b border-border last:border-0 hover:bg-surface-2/60">
                <td className="px-4 py-3">
                  <Link href={`/trades/${trade.id}`} className="font-medium text-white hover:text-gold">
                    {trade.symbol}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={trade.side === "long" ? "positive" : "negative"}>{trade.side}</Badge>
                </td>
                <td className="px-4 py-3 text-gray-300">{trade.setup_tag ?? "—"}</td>
                <td className="px-4 py-3 text-gray-400">{formatDateTime(trade.opened_at)}</td>
                <td className="px-4 py-3">
                  <Badge tone={trade.status === "open" ? "gold" : "neutral"}>
                    {trade.status === "open" ? t("common.open") : t("common.closed")}
                  </Badge>
                </td>
                <td
                  className={`px-4 py-3 text-right font-medium ${
                    pnl === null ? "text-gray-500" : pnl >= 0 ? "text-positive" : "text-negative"
                  }`}
                >
                  {pnl == null ? "—" : formatMoney(pnl)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
