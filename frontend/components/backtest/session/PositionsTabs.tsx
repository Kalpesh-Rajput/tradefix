"use client";

import { useState } from "react";

import { summarize } from "@/lib/backtest/stats";
import type { BookOrder } from "@/lib/backtest/sessionBook";
import type { ClosedTrade, EngineView } from "@/lib/backtest/orderEngine";
import { money } from "@/lib/backtest/sessions";
import Link from "next/link";

const TABS = ["Positions", "Pending orders", "History", "Stats"] as const;

export function PositionsTabs({
  view,
  orders,
  currency,
  onCancel,
  sessionId,
}: {
  view: EngineView;
  orders: readonly BookOrder[];
  currency: string;
  onCancel: (id: string) => void;
  sessionId?: string;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Positions");
  const stats = summarize(view.trades);
  const pending = orders.filter((order) => order.status === "pending");

  return (
    <section className="dash-card p-3">
      <div role="tablist" aria-label="Session book" className="mb-3 flex h-11 gap-1 border-b border-border">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            className={`h-10 px-3 text-sm ${tab === item ? "border-b-2 border-primary font-medium text-foreground" : "text-muted"}`}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>
      {tab === "Positions" ? (
        view.position ? (
          <p className="text-sm text-foreground">
            {view.position.side} {view.position.size} @ {view.position.entryPrice} · stop {view.position.sl ?? "—"} · target {view.position.tp ?? "—"}
          </p>
        ) : (
          <p className="text-sm text-muted">No open position.</p>
        )
      ) : null}
      {tab === "Pending orders" ? (
        pending.length ? (
          <ul className="space-y-2 text-sm">
            {pending.map((order) => (
              <li key={order.id} className="flex items-center justify-between gap-3">
                <span>
                  {order.side} {order.kind} {order.size} {order.price != null ? `@ ${order.price}` : ""}
                  {order.cancelRequested ? " · cancelling" : ""}
                </span>
                <button type="button" className="text-primary" onClick={() => onCancel(order.id)}>
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No pending orders.</p>
        )
      ) : null}
      {tab === "History" ? (
        view.trades.length ? (
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
              {view.trades.map((trade: ClosedTrade) => (
                <tr key={trade.id} className="border-t border-border/60">
                  <td className="py-1.5">{trade.side}</td>
                  <td className="py-1.5 font-mono">{trade.entryPrice}</td>
                  <td className="py-1.5 font-mono">{trade.exitPrice}</td>
                  <td className="py-1.5 text-muted">{trade.exitReason}</td>
                  <td className={`py-1.5 text-right font-mono ${trade.pnl >= 0 ? "text-positive" : "text-negative"}`}>
                    {money(trade.pnl, currency)}
                    {sessionId ? (
                      <>
                        {" "}
                        <Link href={`/replay/session/${sessionId}/${trade.id}`} className="text-primary hover:underline">
                          Replay
                        </Link>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted">No closed trades yet.</p>
        )
      ) : null}
      {tab === "Stats" ? (
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Stat label="Net" value={money(stats.netProfit, currency)} />
          <Stat label="Trades" value={String(stats.tradeCount)} />
          <Stat label="Win rate" value={`${(stats.winRate * 100).toFixed(1)}%`} />
          <Stat label="Expectancy R" value={stats.expectancyR == null ? "—" : stats.expectancyR.toFixed(2)} />
        </dl>
      ) : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted">{label}</dt>
      <dd className="font-mono text-foreground">{value}</dd>
    </div>
  );
}
