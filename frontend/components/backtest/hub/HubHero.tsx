"use client";

import { Database, Plus, Workflow } from "lucide-react";
import Link from "next/link";
import { useMemo, type ReactNode } from "react";

import { Skeleton } from "@/components/ui/Skeleton";
import { formatCoverageDate, summarizeCoverage } from "@/lib/backtest/dataCoverage";
import { summarizeSessions } from "@/lib/backtest/hubStats";
import { money } from "@/lib/backtest/sessions";
import { useBacktestRuns } from "@/lib/hooks/useBacktestRuns";
import { useBacktestSessions, useMarketInstruments } from "@/lib/hooks/useBacktestSessions";

const MAX_CHIPS = 4;

function Stat({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <div className="min-w-0 border-white/10 px-4 py-2.5 first:pl-0 sm:border-l sm:first:border-l-0" title={hint}>
      <p className="truncate text-[10px] font-medium uppercase tracking-[0.14em] text-white/50">{label}</p>
      <div className="mt-1 font-mono text-lg font-semibold tabular-nums leading-none text-white">{children}</div>
    </div>
  );
}

function Value({ loading, children }: { loading: boolean; children: ReactNode }) {
  return loading ? <Skeleton className="h-5 w-10 bg-white/15" /> : <>{children}</>;
}

export function HubHero({ adminAction }: { adminAction?: ReactNode }) {
  const sessions = useBacktestSessions();
  const runs = useBacktestRuns();
  const instruments = useMarketInstruments();
  const stats = summarizeSessions(sessions.data ?? []);
  const coverage = useMemo(() => summarizeCoverage(instruments.data ?? []), [instruments.data]);
  const completedRuns = (runs.data ?? []).filter((run) => run.status === "succeeded").length;
  const chips = coverage.entries.slice(0, MAX_CHIPS);
  const extra = coverage.entries.length - chips.length;

  return (
    <section className="sidebar-chrome relative isolate overflow-hidden rounded-xl border border-white/10 bg-[var(--color-sidebar)] px-5 py-5 text-white shadow-[0_18px_44px_-30px_rgba(10,8,30,0.8)] sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_140%_at_100%_-30%,hsl(var(--primary)/0.4),transparent_62%)]"
      />
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div className="min-w-0 max-w-xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#a78bfa]">Practice desk</p>
          <h1 className="mt-1.5 font-brand text-3xl font-semibold leading-tight tracking-tight text-white">Backtesting</h1>
          <p className="mt-1.5 text-sm leading-6 text-white/65">
            Trade a session by hand on stored candles, or run a rule-based strategy across a date range and review every simulated trade.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/backtest/sessions/new"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#8b6cf6] px-4 text-sm font-semibold text-white transition hover:bg-[#9b80f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1c1c3a] motion-reduce:transition-none"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New session
          </Link>
          <Link
            href="/backtest/strategies/new"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/20 bg-white/[0.05] px-4 text-sm font-medium text-white transition hover:border-white/35 hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 motion-reduce:transition-none"
          >
            <Workflow className="h-4 w-4" aria-hidden />
            Build strategy
          </Link>
          {adminAction}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-y-1 border-t border-white/10 pt-3 sm:grid-cols-5" role="group" aria-label="Your practice at a glance">
        <Stat label="Manual sessions" hint="Sessions you trade by hand">
          <Value loading={sessions.isLoading}>{stats.sessions}</Value>
        </Stat>
        <Stat label="Active" hint="Manual sessions that can still be resumed">
          <Value loading={sessions.isLoading}>{stats.active}</Value>
        </Stat>
        <Stat label="Session trades" hint="Simulated trades across your manual sessions">
          <Value loading={sessions.isLoading}>{stats.trades}</Value>
        </Stat>
        <Stat label="Session net P&L" hint="Net profit across manual sessions, shown only when they share one currency">
          <Value loading={sessions.isLoading}>
            {stats.net ? (
              <span className={stats.net.amount === 0 ? "text-white" : stats.net.amount > 0 ? "text-[#5ee0b0]" : "text-[#ff8a93]"}>
                {money(stats.net.amount, stats.net.currency)}
              </span>
            ) : (
              <span className="text-base text-white/60">{stats.sessions === 0 ? "—" : "Mixed"}</span>
            )}
          </Value>
        </Stat>
        <Stat label="Completed runs" hint="Automated strategy backtests that finished successfully">
          <Value loading={runs.isLoading}>{completedRuns}</Value>
        </Stat>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/60">
        <Database className="h-3.5 w-3.5" aria-hidden />
        {instruments.isLoading ? (
          <Skeleton className="h-4 w-48 bg-white/15" />
        ) : instruments.isError ? (
          <span>Market data coverage unavailable.</span>
        ) : coverage.entries.length === 0 ? (
          <span>No market data has been imported yet.</span>
        ) : (
          <>
            <span>Data ready</span>
            {chips.map((entry) => (
              <span
                key={entry.symbol}
                title={`${formatCoverageDate(entry.fromMs)} – ${formatCoverageDate(entry.toMs)} (UTC)`}
                className="rounded-full border border-white/15 bg-white/[0.05] px-2.5 py-0.5 font-medium text-white/85"
              >
                {entry.label}
              </span>
            ))}
            {extra > 0 ? <span>+{extra} more</span> : null}
            {coverage.fromMs != null && coverage.toMs != null ? (
              <span>
                {formatCoverageDate(coverage.fromMs)} – {formatCoverageDate(coverage.toMs)} UTC
              </span>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
