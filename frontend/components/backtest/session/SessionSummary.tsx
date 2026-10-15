import Link from "next/link";

import { summarize } from "@/lib/backtest/stats";
import type { ClosedTrade } from "@/lib/backtest/orderEngine";
import { money } from "@/lib/backtest/sessions";

export function SessionSummary({
  sessionId,
  currency,
  initialBalance,
  trades,
  warnings,
}: {
  sessionId: string;
  currency: string;
  initialBalance: number;
  trades: readonly ClosedTrade[];
  warnings: readonly string[];
}) {
  const stats = summarize(trades);
  const points = trades.reduce<number[]>((series, trade) => {
    series.push((series.at(-1) ?? initialBalance) + trade.pnl);
    return series;
  }, [initialBalance]);

  return (
    <section className="dash-card space-y-4 p-4" aria-label="Session summary">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Session summary</h2>
        <p className="mt-1 text-sm text-muted">These figures are the ones replayed in this session. Open a trade to replay it on the stored candles.</p>
      </div>
      <EquityCurve points={points} />
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Item label="Net" value={money(stats.netProfit, currency)} />
        <Item label="Balance" value={money(points.at(-1) ?? initialBalance, currency)} />
        <Item label="Win rate" value={`${(stats.winRate * 100).toFixed(1)}%`} />
        <Item label="Expectancy R" value={stats.expectancyR == null ? "—" : stats.expectancyR.toFixed(2)} />
      </dl>
      {warnings.length ? <p className="text-xs text-muted">{warnings.join(" · ")}</p> : null}
      {trades.length ? (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-muted">
              <th className="py-1 font-medium">Side</th>
              <th className="py-1 font-medium">Entry</th>
              <th className="py-1 font-medium">Exit</th>
              <th className="py-1 font-medium">Reason</th>
              <th className="py-1 text-right font-medium">P&L</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade) => (
              <tr key={trade.id} className="border-t border-border/60">
                <td className="py-1.5">{trade.side}</td>
                <td className="py-1.5 font-mono">{trade.entryPrice}</td>
                <td className="py-1.5 font-mono">{trade.exitPrice}</td>
                <td className="py-1.5 text-muted">{trade.exitReason}</td>
                <td className="py-1.5 text-right">
                  <span className={`font-mono ${trade.pnl >= 0 ? "text-positive" : "text-negative"}`}>{money(trade.pnl, currency)}</span>{" "}
                  <Link href={`/replay/session/${sessionId}/${trade.id}`} className="text-primary hover:underline">
                    Replay
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-muted">No trades were closed in this session.</p>
      )}
    </section>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted">{label}</dt>
      <dd className="font-mono text-foreground">{value}</dd>
    </div>
  );
}

function EquityCurve({ points }: { points: number[] }) {
  if (points.length < 2) return <p className="text-sm text-muted">The equity curve appears after the first closed trade.</p>;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const path = points
    .map((value, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 36 - ((value - min) / span) * 32;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const up = points[points.length - 1] >= points[0];
  return (
    <svg viewBox="0 0 100 40" className="h-24 w-full" role="img" aria-label="Equity curve">
      <path d={path} fill="none" stroke={up ? "var(--color-chart-profit)" : "var(--color-chart-loss)"} strokeWidth="1.5" />
    </svg>
  );
}
