"use client";

import Link from "next/link";

import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { Card, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAnalytics } from "@/lib/hooks/useAnalytics";

export default function BacktestPage() {
  const { activeAccount, formatMoney, loading: accountsLoading } = useAccountPrefs();
  const accountId = activeAccount?.id;
  const { data, isLoading, isError, refetch } = useAnalytics(accountId, {
    enabled: !!accountId,
  });

  const rows = data?.expectancy_by_tag ?? [];
  const loading = accountsLoading || (isLoading && !!accountId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Setup Lab</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Expectancy by setup tag from your live journal. Full candle replay is on the roadmap.
        </p>
      </div>

      {loading ? (
        <Skeleton className="h-64" />
      ) : isError || !data ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm">
          Couldn’t load setup lab.{" "}
          <button type="button" onClick={() => refetch()} className="text-primary hover:underline">
            Retry
          </button>
        </div>
      ) : (
        <Card>
          <CardHeader title="Expectancy by setup" subtitle={`${rows.length} tagged setups`} />
          {rows.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Tag setups on closed trades to populate the setup lab.{" "}
              <Link href="/trades" className="text-primary hover:underline">
                Open trades
              </Link>
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[11px] uppercase tracking-wider text-zinc-500">
                    <th className="pb-2 font-medium">Setup</th>
                    <th className="pb-2 font-medium">Trades</th>
                    <th className="pb-2 font-medium">Win rate</th>
                    <th className="pb-2 font-medium">Expectancy</th>
                    <th className="pb-2 font-medium">Avg R</th>
                    <th className="pb-2 font-medium text-right">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.tag} className="border-b border-white/[0.04]">
                      <td className="py-2.5 font-medium text-white">{row.tag}</td>
                      <td className="py-2.5 text-zinc-400">{row.trades}</td>
                      <td className="py-2.5 text-zinc-400">{row.win_rate}%</td>
                      <td className="py-2.5 font-mono text-zinc-300">{formatMoney(row.expectancy)}</td>
                      <td className="py-2.5 text-zinc-400">
                        {row.avg_r != null ? `${row.avg_r.toFixed(2)}R` : "—"}
                      </td>
                      <td
                        className={`py-2.5 text-right font-mono ${
                          row.pnl >= 0 ? "text-positive" : "text-negative"
                        }`}
                      >
                        {formatMoney(row.pnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
