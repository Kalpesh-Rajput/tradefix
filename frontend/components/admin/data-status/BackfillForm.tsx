"use client";

import { useState, type FormEvent } from "react";

import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api";
import { useEnqueueBackfill, type InstrumentStatus } from "@/lib/hooks/useDataStatus";

const FIELD = "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-primary";

export function BackfillForm({ instruments }: { instruments: InstrumentStatus[] }) {
  const enqueue = useEnqueueBackfill();
  const toast = useToast();
  const [symbol, setSymbol] = useState(instruments.find((item) => item.enabled)?.symbol ?? "");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    if (!symbol || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      setError("Choose an instrument and a range that ends after it starts.");
      return;
    }
    enqueue.mutate(
      { symbol, start_ms: startMs, end_ms: endMs },
      {
        onSuccess: (result) => toast.success(result.created ? "Backfill queued" : "That range is already queued", symbol),
        onError: (err) => {
          const message = err instanceof ApiError ? err.message : "Try again.";
          setError(message);
          toast.error("Couldn’t queue the backfill", message);
        },
      },
    );
  }

  return (
    <form onSubmit={onSubmit} className="dash-card space-y-3 p-4">
      <h2 className="text-sm font-medium text-foreground">Enqueue backfill</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm text-muted">
          Instrument
          <select className={FIELD} value={symbol} onChange={(event) => setSymbol(event.target.value)}>
            {instruments.map((item) => (
              <option key={item.symbol} value={item.symbol}>{item.symbol}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-muted">
          Start
          <input className={FIELD} type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} />
        </label>
        <label className="text-sm text-muted">
          End
          <input className={FIELD} type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} />
        </label>
      </div>
      {error ? <p className="text-sm text-negative">{error}</p> : null}
      <button type="submit" className="dash-btn-primary h-10 px-3 text-sm" disabled={enqueue.isPending}>
        {enqueue.isPending ? "Queueing…" : "Queue backfill"}
      </button>
    </form>
  );
}
