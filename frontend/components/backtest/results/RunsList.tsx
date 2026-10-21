"use client";

import { Activity, ArrowRight, Trash2 } from "lucide-react";
import Link from "next/link";

import { HubEmpty } from "@/components/backtest/hub/HubEmpty";
import { HubPanel } from "@/components/backtest/hub/HubPanel";
import { pnlClass } from "@/components/backtest/hub/pnl";
import { Skeleton } from "@/components/ui/Skeleton";
import { pairLabel } from "@/lib/backtest/hubStats";
import { useBacktestRuns, useDeleteRun, type BacktestRun } from "@/lib/hooks/useBacktestRuns";

const STATUS: Record<BacktestRun["status"], { label: string; tone: string }> = {
  queued: { label: "Queued", tone: "border-border bg-surface text-muted" },
  running: { label: "Running", tone: "border-primary/25 bg-primary/10 text-primary" },
  waiting_data: { label: "Waiting for data", tone: "border-[var(--color-warning-badge)]/50 bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]" },
  succeeded: { label: "Complete", tone: "border-[var(--color-success-text)]/25 bg-[var(--color-success-text)]/10 text-[var(--color-success-text)]" },
  failed: { label: "Failed", tone: "border-[var(--color-danger-text)]/25 bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]" },
  cancelled: { label: "Cancelled", tone: "border-border bg-surface text-muted" },
};

export function RunsList() {
  const runs = useBacktestRuns();
  const remove = useDeleteRun();

  if (runs.isLoading) {
    return (
      <HubPanel title="Backtest runs">
        <div className="space-y-3 p-5">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      </HubPanel>
    );
  }
  if (runs.isError) {
    return (
      <div className="dash-card px-6 py-10 text-center">
        <p className="text-sm text-negative">Couldn’t load runs.</p>
        <button type="button" className="mt-2 text-sm font-medium text-primary hover:underline" onClick={() => runs.refetch()}>
          Retry
        </button>
      </div>
    );
  }
  const rows = runs.data ?? [];
  if (rows.length === 0) {
    return (
      <HubEmpty
        icon={Activity}
        title="No backtest runs yet"
        body="Run a saved strategy and the equity curve, drawdown and every simulated trade will land here."
      />
    );
  }
  return (
    <HubPanel title="Backtest runs" subtitle={`${rows.length} ${rows.length === 1 ? "run" : "runs"}`}>
      <ul className="divide-y divide-border/60">
        {rows.map((run) => {
          const status = STATUS[run.status];
          const net = run.metrics?.net_profit;
          return (
            <li key={run.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-primary/[0.035]">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-gradient-to-br from-primary/15 to-primary/5 text-[11px] font-bold text-primary">
                  {run.symbol.slice(0, 3)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold tracking-tight text-foreground">{run.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {pairLabel(run.symbol)} · {run.timeframe}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {net != null ? (
                  <span className={`font-mono text-sm font-semibold tabular-nums ${pnlClass(net)}`}>
                    {net > 0 ? "+" : ""}
                    {net.toFixed(2)}
                  </span>
                ) : null}
                <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.tone}`}>{status.label}</span>
                <div className="flex items-center gap-1">
                  <Link
                    href={`/backtest/runs/${run.id}`}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-primary/25 bg-primary/10 px-3 text-xs font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none"
                  >
                    Open
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                  <button
                    type="button"
                    aria-label={`Delete run ${run.name}`}
                    title="Delete"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none"
                    onClick={() => {
                      if (window.confirm("Delete this run?")) void remove.mutate(run.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </HubPanel>
  );
}
