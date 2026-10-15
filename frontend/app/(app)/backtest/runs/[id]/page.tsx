"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { EquityDrawdown } from "@/components/backtest/results/EquityDrawdown";
import { ResultBreakdowns } from "@/components/backtest/results/ResultBreakdowns";
import { ResultsKpis } from "@/components/backtest/results/ResultsKpis";
import { RunStatusPanel } from "@/components/backtest/results/RunStatusPanel";
import { RunTradesTable } from "@/components/backtest/results/RunTradesTable";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError, api } from "@/lib/api";
import { useBacktestRun, useCancelRun, useDeleteRun, useRunTrades } from "@/lib/hooks/useBacktestRuns";

export default function BacktestRunPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const run = useBacktestRun(params.id ?? "");
  const cancel = useCancelRun();
  const remove = useDeleteRun();
  const [filters, setFilters] = useState({ side: "", exitReason: "" });
  const trades = useRunTrades(params.id ?? "", { side: filters.side || undefined, exit_reason: filters.exitReason || undefined });
  const data = run.data;

  async function rerun() {
    if (!data?.strategy_id) {
      toast.error("This run has no saved strategy to repeat.");
      return;
    }
    try {
      const created = await api.post<{ id: string }>("/api/backtests", { strategy_id: data.strategy_id });
      router.push(`/backtest/runs/${created.id}`);
    } catch (error) {
      toast.error("Couldn’t start another run", error instanceof ApiError ? error.message : "Try again.");
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Link href="/backtest" className="text-sm text-muted hover:text-foreground">Back to backtesting</Link>
      {run.isLoading ? (
        <div className="dash-card space-y-3 p-5">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-24" />
        </div>
      ) : null}
      {run.isError ? (
        <div className="dash-card px-6 py-10 text-center">
          <p className="text-sm text-negative">This run isn’t available.</p>
          <button type="button" className="mt-2 text-sm text-primary hover:underline" onClick={() => run.refetch()}>Retry</button>
        </div>
      ) : null}
      {data ? (
        <>
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-foreground">{data.name}</h1>
              <p className="text-sm text-muted">
                {data.symbol} · {data.timeframe} · {new Date(data.start_ms).toISOString().slice(0, 10)} to {new Date(data.end_ms).toISOString().slice(0, 10)} · {data.bars_processed} bars
              </p>
            </div>
            <div className="flex gap-2">
              {data.strategy_id ? <Link href={`/backtest/strategies/${data.strategy_id}`} className="dash-btn-secondary inline-flex h-10 items-center px-3 text-sm">Edit strategy</Link> : null}
              <button type="button" className="dash-btn-secondary h-10 px-3 text-sm" onClick={() => void rerun()}>Run again</button>
              <button
                type="button"
                className="dash-btn-secondary h-10 px-3 text-sm"
                onClick={() => {
                  if (!window.confirm("Delete this run?")) return;
                  void remove.mutateAsync(data.id).then(() => router.push("/backtest"));
                }}
              >
                Delete
              </button>
            </div>
          </header>
          {data.warnings?.length ? <p className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted">{data.warnings.join(" · ")}</p> : null}
          {data.status !== "succeeded" ? (
            <RunStatusPanel run={data} cancelling={cancel.isPending} onCancel={() => cancel.mutate(data.id)} />
          ) : (
            <>
              <ResultsKpis metrics={data.metrics} />
              <EquityDrawdown points={data.equity ?? []} />
              <ResultBreakdowns trades={trades.data?.trades ?? []} equity={data.equity ?? []} />
              {trades.isLoading ? <Skeleton className="h-40" /> : null}
              {trades.isError ? <p className="text-sm text-negative">Couldn’t load trades.</p> : null}
              {trades.data ? (
                <RunTradesTable
                  runId={data.id}
                  trades={trades.data.trades}
                  total={trades.data.total}
                  side={filters.side}
                  exitReason={filters.exitReason}
                  onFilter={setFilters}
                />
              ) : null}
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
