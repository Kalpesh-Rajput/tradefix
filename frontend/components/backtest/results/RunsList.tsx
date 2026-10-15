"use client";

import Link from "next/link";

import { Skeleton } from "@/components/ui/Skeleton";
import { useBacktestRuns, useDeleteRun } from "@/lib/hooks/useBacktestRuns";

export function RunsList() {
  const runs = useBacktestRuns();
  const remove = useDeleteRun();

  if (runs.isLoading) {
    return (
      <div className="dash-card space-y-3 p-5">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-12" />
      </div>
    );
  }
  if (runs.isError) {
    return (
      <div className="dash-card px-6 py-10 text-center">
        <p className="text-sm text-negative">Couldn’t load runs.</p>
        <button type="button" className="mt-2 text-sm text-primary hover:underline" onClick={() => runs.refetch()}>Retry</button>
      </div>
    );
  }
  const rows = runs.data ?? [];
  if (rows.length === 0) {
    return (
      <div className="dash-card px-6 py-14 text-center">
        <p className="text-sm font-medium text-foreground">No backtest runs yet</p>
        <p className="mt-1 text-sm text-muted">Run a saved strategy and the result will show up here.</p>
      </div>
    );
  }
  return (
    <ul className="dash-card divide-y divide-border">
      {rows.map((run) => (
        <li key={run.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">{run.name}</p>
            <p className="text-xs text-muted">
              {run.symbol} · {run.timeframe} · {run.status}
              {run.metrics?.net_profit != null ? ` · ${run.metrics.net_profit.toFixed(2)}` : ""}
            </p>
          </div>
          <div className="flex gap-3 text-sm">
            <Link href={`/backtest/runs/${run.id}`} className="text-primary hover:underline">Open</Link>
            <button
              type="button"
              className="text-muted hover:text-foreground"
              onClick={() => {
                if (window.confirm("Delete this run?")) void remove.mutate(run.id);
              }}
            >
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
