"use client";

import { useState } from "react";
import { ArrowRight, ChevronDown, ChevronUp, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { fmtMoney, fmtPct } from "@/lib/format";

type Metric = {
  label: string;
  value: string;
  sub?: string;
  tone?: "primary" | "white" | "danger";
};

export function PerformanceGrid({
  metrics,
  totalTrades,
  equitySeries,
  largestGain,
  largestLoss,
  bySetup,
}: {
  metrics: Metric[];
  totalTrades: number;
  equitySeries: { date: string; value: number }[];
  largestGain?: { symbol: string; pnl: number; date?: string } | null;
  largestLoss?: { symbol: string; pnl: number; date?: string } | null;
  bySetup?: { setup_tag: string; pnl: number; trades: number }[];
}) {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <button type="button" onClick={() => setOpen((v) => !v)} className="group mb-4 flex w-full items-center justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="h-px flex-1 bg-white/[0.06]" />
          <span className="whitespace-nowrap text-[10px] uppercase tracking-widest text-zinc-500">Performance</span>
          <div className="h-px flex-1 bg-white/[0.06]" />
        </div>
        <div className="ml-3 flex shrink-0 items-center gap-1.5 text-[10px] text-zinc-600 transition-colors group-hover:text-zinc-400">
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </div>
      </button>

      {open && (
        <div>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {metrics.map((m) => (
              <div key={m.label} className="border-b border-white/[0.06] pb-3">
                <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">{m.label}</div>
                <div
                  className={`font-mono text-xl font-medium ${
                    m.tone === "white" ? "text-white" : m.tone === "danger" ? "text-destructive" : "text-primary"
                  }`}
                >
                  {m.value}
                </div>
                {m.sub && <div className="mt-0.5 text-[9px] text-zinc-600">{m.sub}</div>}
              </div>
            ))}
          </div>

          {totalTrades > 0 && (
            <p className="mb-4 text-[11px] text-zinc-600">
              Includes <span className="text-primary">{totalTrades} manual trade{totalTrades === 1 ? "" : "s"}</span>
            </p>
          )}

          <ThisWeekStrip />

          <div className="mb-4 rounded-xl border border-white/[0.06] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-wider text-zinc-500">Cumulative P&L</h3>
              <span className="font-mono text-xs text-primary">
                {equitySeries.length
                  ? fmtMoney(equitySeries[equitySeries.length - 1]?.value ?? 0)
                  : "+$0"}
              </span>
            </div>
            <div className="h-40 w-full">
              {equitySeries.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={equitySeries}>
                    <defs>
                      <linearGradient id="pnlFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00C896" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#00C896" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" hide />
                    <YAxis hide domain={["auto", "auto"]} />
                    <Tooltip
                      contentStyle={{
                        background: "#09090b",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(v: number) => [fmtMoney(v), "P&L"]}
                    />
                    <Area type="monotone" dataKey="value" stroke="#00C896" fill="url(#pnlFill)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-zinc-600">Log trades to see equity curve</div>
              )}
            </div>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-primary">
                <TrendingUp className="h-3 w-3" /> Largest Gain
              </div>
              {largestGain ? (
                <>
                  <div className="mb-0.5 font-mono text-sm font-medium text-white">{largestGain.symbol}</div>
                  <div className="font-mono text-lg text-primary">{fmtMoney(largestGain.pnl)}</div>
                  {largestGain.date && <div className="mt-1 text-[10px] text-zinc-500">{largestGain.date.slice(0, 10)}</div>}
                </>
              ) : (
                <p className="text-xs text-zinc-500">No closed wins yet</p>
              )}
            </div>
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
              <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-destructive">
                <TrendingDown className="h-3 w-3" /> Largest Loss
              </div>
              {largestLoss ? (
                <>
                  <div className="mb-0.5 font-mono text-sm font-medium text-white">{largestLoss.symbol}</div>
                  <div className="font-mono text-lg text-destructive">{fmtMoney(Math.abs(largestLoss.pnl), { signed: false })}</div>
                  {largestLoss.date && <div className="mt-1 text-[10px] text-zinc-500">{largestLoss.date.slice(0, 10)}</div>}
                </>
              ) : (
                <p className="text-xs text-zinc-500">No closed losses yet</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] p-4">
            <h3 className="mb-4 text-xs uppercase tracking-wider text-zinc-500">Strategy Breakdown</h3>
            {(bySetup?.length ?? 0) === 0 ? (
              <p className="text-xs text-zinc-600">
                No strategy data yet — add strategy tags to your trades to see a breakdown.
              </p>
            ) : (
              <ul className="space-y-2">
                {bySetup!.slice(0, 6).map((s) => (
                  <li key={s.setup_tag} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300">{s.setup_tag}</span>
                    <span className={s.pnl >= 0 ? "font-mono text-primary" : "font-mono text-destructive"}>
                      {fmtMoney(s.pnl)} · {s.trades}t
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ThisWeekStrip() {
  const today = new Date();
  const day = today.getDay();
  const start = new Date(today);
  start.setDate(today.getDate() - day);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });

  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <Link href="/calendar">
      <div className="group mb-4 cursor-pointer rounded-xl border border-white/[0.06] p-4 transition-colors hover:border-white/[0.14]">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs uppercase tracking-wider text-zinc-500">This Week</h3>
          <ArrowRight className="h-3 w-3 text-zinc-600 transition-colors group-hover:text-zinc-400" />
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {labels.map((l) => (
            <div key={l} className="pb-1 text-center text-[9px] font-medium uppercase tracking-wide text-zinc-600">
              {l}
            </div>
          ))}
          {days.map((d) => {
            const isToday = d.toDateString() === today.toDateString();
            const inMonth = d.getMonth() === today.getMonth();
            return (
              <div
                key={d.toISOString()}
                className={`flex h-14 flex-col justify-between rounded-lg p-1.5 ${
                  inMonth ? "" : "bg-white/[0.01]"
                } ${isToday ? "ring-1 ring-primary/60" : ""}`}
                style={inMonth ? { background: "rgba(255, 255, 255, 0.03)" } : undefined}
              >
                {inMonth && (
                  <span className="text-[11px] font-medium leading-none text-white/60">{d.getDate()}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Link>
  );
}

export function buildPerformanceMetrics(input: {
  netPnl: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  totalTrades: number;
  wins: number;
  losses: number;
}): Metric[] {
  return [
    {
      label: "Net P&L (USD)",
      value: fmtMoney(input.netPnl),
      sub: "Equity · Crypto · Options · Futures",
      tone: "primary",
    },
    {
      label: "Win Rate",
      value: fmtPct(input.winRate),
      sub: `${input.wins}W / ${input.losses}L`,
      tone: "primary",
    },
    {
      label: "Profit Factor",
      value: input.profitFactor ? input.profitFactor.toFixed(2) : "—",
      sub: "avg win / avg loss",
      tone: "primary",
    },
    {
      label: "Avg Win",
      value: fmtMoney(input.avgWin, { signed: false, digits: 0 }),
      sub: "excl. forex",
      tone: "primary",
    },
    {
      label: "Total Trades",
      value: String(input.totalTrades),
      sub: "all asset classes",
      tone: "white",
    },
  ];
}
