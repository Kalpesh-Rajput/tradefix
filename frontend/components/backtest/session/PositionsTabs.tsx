"use client";

import Link from "next/link";
import { useState } from "react";

import { summarize } from "@/lib/backtest/stats";
import type { BookOrder } from "@/lib/backtest/sessionBook";
import type { ClosedTrade, EngineView } from "@/lib/backtest/orderEngine";
import { money } from "@/lib/backtest/sessions";

const TABS = ["Positions", "Pending orders", "History", "Stats"] as const;

const EXIT_LABEL: Record<string, string> = {
  tp: "Target",
  sl: "Stop",
  manual: "Manual",
  "session end": "Session end",
};

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
  const counts: Record<(typeof TABS)[number], number> = {
    Positions: view.position ? 1 : 0,
    "Pending orders": pending.length,
    History: view.trades.length,
    Stats: 0,
  };

  return (
    <section className="dash-card flex max-h-64 min-h-40 flex-col overflow-hidden">
      <div role="tablist" aria-label="Session book" className="flex h-11 shrink-0 items-end gap-1 border-b border-border px-2">
        {TABS.map((item) => {
          const selected = tab === item;
          const count = counts[item];
          return (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`inline-flex h-10 items-center gap-1.5 border-b-2 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                selected ? "border-primary font-medium text-foreground" : "border-transparent text-muted hover:text-foreground"
              }`}
              onClick={() => setTab(item)}
            >
              {item}
              {count > 0 ? <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold tabular-nums text-primary">{count}</span> : null}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {tab === "Positions" ? (
          view.position ? (
            <dl className="grid gap-3 text-sm sm:grid-cols-4">
              <Fact label="Side" value={labelSide(view.position.side)} tone={view.position.side} />
              <Fact label="Size" value={String(view.position.size)} />
              <Fact label="Entry" value={String(view.position.entryPrice)} mono />
              <Fact label="Stop / target" value={`${view.position.sl ?? "—"} / ${view.position.tp ?? "—"}`} mono />
            </dl>
          ) : (
            <Empty title="No open position" detail="Buy or sell from the order ticket. The position shows up here while it is open." />
          )
        ) : null}

        {tab === "Pending orders" ? (
          pending.length ? (
            <ul className="space-y-2 text-sm">
              {pending.map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-3 rounded-lg bg-[hsl(var(--surface-2))] px-3 py-2">
                  <span className="min-w-0">
                    <span className={order.side === "buy" ? "font-medium text-[var(--color-success-text)]" : "font-medium text-[var(--color-danger-text)]"}>{labelSide(order.side)}</span>{" "}
                    <span className="text-muted">{order.kind}</span> <span className="tabular-nums">{order.size}</span>
                    {order.price != null ? <span className="font-mono tabular-nums"> @ {order.price}</span> : null}
                    {order.cancelRequested ? <span className="text-muted"> · Cancelling</span> : null}
                  </span>
                  <button type="button" className="shrink-0 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" onClick={() => onCancel(order.id)}>
                    Cancel
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No pending orders" detail="Limit and stop orders wait here until price reaches them." />
          )
        ) : null}

        {tab === "History" ? (
          view.trades.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-muted">
                    <th className="py-1.5 font-medium">Side</th>
                    <th className="py-1.5 font-medium">Entry</th>
                    <th className="py-1.5 font-medium">Exit</th>
                    <th className="py-1.5 font-medium">Reason</th>
                    <th className="py-1.5 text-right font-medium">P&amp;L</th>
                    <th className="py-1.5 text-right font-medium">
                      <span className="sr-only">Replay</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {view.trades.map((trade: ClosedTrade) => (
                    <tr key={trade.id} className="border-t border-border/70">
                      <td className={`py-2 font-medium ${trade.side === "buy" ? "text-[var(--color-success-text)]" : "text-[var(--color-danger-text)]"}`}>{labelSide(trade.side)}</td>
                      <td className="py-2 font-mono tabular-nums">{trade.entryPrice}</td>
                      <td className="py-2 font-mono tabular-nums">{trade.exitPrice}</td>
                      <td className="py-2 text-muted">{EXIT_LABEL[trade.exitReason] ?? trade.exitReason}</td>
                      <td className={`py-2 text-right font-mono tabular-nums ${trade.pnl >= 0 ? "text-[var(--color-success-text)]" : "text-[var(--color-danger-text)]"}`}>{money(trade.pnl, currency)}</td>
                      <td className="py-2 text-right">
                        {sessionId ? (
                          <Link href={`/replay/session/${sessionId}/${trade.id}`} className="text-xs font-medium text-primary hover:underline">
                            Replay
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="No closed trades yet" detail="Closed trades, with P&L and a replay link, collect here." />
          )
        ) : null}

        {tab === "Stats" ? (
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Net" value={money(stats.netProfit, currency)} tone={stats.netProfit > 0 ? "up" : stats.netProfit < 0 ? "down" : "flat"} />
            <Stat label="Trades" value={String(stats.tradeCount)} />
            <Stat label="Win rate" value={`${(stats.winRate * 100).toFixed(1)}%`} />
            <Stat label="Expectancy R" value={stats.expectancyR == null ? "—" : stats.expectancyR.toFixed(2)} />
          </dl>
        ) : null}
      </div>
    </section>
  );
}

function labelSide(side: string): string {
  if (side === "buy") return "Buy";
  if (side === "sell") return "Sell";
  return side;
}

function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex h-full min-h-16 flex-col justify-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-0.5 max-w-md text-xs leading-4 text-muted">{detail}</p>
    </div>
  );
}

function Fact({ label, value, mono, tone }: { label: string; value: string; mono?: boolean; tone?: string }) {
  const color = tone === "buy" ? "text-[var(--color-success-text)]" : tone === "sell" ? "text-[var(--color-danger-text)]" : "text-foreground";
  return (
    <div className="rounded-lg bg-[hsl(var(--surface-2))] px-3 py-2">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className={`mt-0.5 text-sm ${mono ? "font-mono tabular-nums" : "font-medium"} ${color}`}>{value}</dd>
    </div>
  );
}

function Stat({ label, value, tone = "flat" }: { label: string; value: string; tone?: "up" | "down" | "flat" }) {
  const color = tone === "up" ? "text-[var(--color-success-text)]" : tone === "down" ? "text-[var(--color-danger-text)]" : "text-foreground";
  return (
    <div className="rounded-lg bg-[hsl(var(--surface-2))] px-3 py-2">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className={`mt-0.5 font-mono text-sm tabular-nums ${color}`}>{value}</dd>
    </div>
  );
}
