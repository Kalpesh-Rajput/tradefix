"use client";

import type { BacktestRun } from "@/lib/hooks/useBacktestRuns";

const STAGE: Record<string, string> = {
  loading: "Loading market data",
  indicators: "Computing indicators",
  simulation: "Simulating",
  done: "Done",
};

const FAILURE: Record<string, string> = {
  data_unavailable: "Market data unavailable",
  insufficient_data: "Not enough candles",
};

export function RunStatusPanel({ run, onCancel, cancelling }: { run: BacktestRun; onCancel: () => void; cancelling: boolean }) {
  const waiting = run.status === "waiting_data";
  const active = run.status === "queued" || run.status === "running" || waiting;
  const label = waiting
    ? "Candles for this range are still being prepared. This run continues when they are stored."
    : (STAGE[run.progress_message ?? ""] ?? run.progress_message ?? run.status);
  const heading = waiting ? "Waiting for market data" : active ? "Run in progress" : (FAILURE[run.error_code ?? ""] ?? run.status);
  return (
    <section className="dash-card space-y-3 p-4" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-foreground">{heading}</h2>
          <p className="text-sm text-muted">{label}</p>
        </div>
        {active ? (
          <button type="button" className="dash-btn-secondary h-9 px-3 text-sm" disabled={cancelling} onClick={onCancel}>
            {cancelling ? "Cancelling…" : "Cancel"}
          </button>
        ) : null}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface">
        <div className="h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, run.progress))}%` }} />
      </div>
      {run.status === "failed" && run.error_message ? <p className="text-sm text-negative">{run.error_message}</p> : null}
      {run.status === "cancelled" ? <p className="text-sm text-muted">This run was cancelled.</p> : null}
    </section>
  );
}
