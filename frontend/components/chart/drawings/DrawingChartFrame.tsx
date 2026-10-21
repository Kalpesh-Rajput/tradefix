"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import type { CandleChartHandle } from "@/components/chart/CandleChart";
import { useToast } from "@/components/ui/Toast";
import { useChartDrawings } from "@/lib/hooks/useChartDrawings";

import { bindDrawings } from "./bindDom";
import { DrawingController, type DrawingScope } from "./controller";
import type { DrawingContext } from "./types";
import { DrawingProperties } from "./ui/DrawingProperties";
import { DrawingToolbar } from "./ui/DrawingToolbar";
import { ObjectList } from "./ui/ObjectList";
import type { SimulateHandler } from "./ui/PositionEditor";

export type DrawingChartFrameProps = {
  /** The chart handle once it has mounted (the chart is loaded lazily, so this starts as null). */
  chart: CandleChartHandle | null;
  workspace: string;
  symbol: string;
  sessionId?: string | null;
  source?: string | null;
  timeframe?: string | null;
  context: DrawingContext;
  sizeUnit: string;
  onSimulate?: SimulateHandler;
  children: ReactNode;
};

function SaveStatus({ phase, error, onRetry }: { phase: string; error: string | null; onRetry: () => void }) {
  if (phase === "error") {
    return (
      <div role="alert" className="absolute bottom-8 left-2 z-20 flex items-center gap-2 rounded-md border border-[var(--color-danger-light)] bg-negative-soft px-2 py-1 text-[11px] text-negative">
        {error ?? "Couldn’t save drawings."}
        <button type="button" onClick={onRetry} className="font-semibold underline-offset-2 hover:underline">
          Retry
        </button>
      </div>
    );
  }
  return (
    <span role="status" aria-live="polite" className="pointer-events-none absolute bottom-8 left-2 z-10 text-[10px] text-muted">
      {phase === "saving" ? "Saving drawings…" : phase === "saved" ? "Drawings saved" : ""}
    </span>
  );
}

/** Chart + left toolbar + selection settings. Owns persistence; the chart engine itself is untouched. */
export function DrawingChartFrame({ chart, workspace, symbol, sessionId, source = null, timeframe = null, context, sizeUnit, onSimulate, children }: DrawingChartFrameProps) {
  const toast = useToast();
  const { store, load, save, error, retryLoad, retrySave } = useChartDrawings({ workspace, symbol, sessionId });
  const ctxRef = useRef(context);
  const scopeRef = useRef<DrawingScope>({ symbol, source, timeframe });
  ctxRef.current = context;
  scopeRef.current = { symbol, source, timeframe };
  const [listOpen, setListOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const ready = load === "ready";
  useEffect(() => {
    if (!chart) return;
    chart.setSurfaceClient((surface) => {
      const controller = new DrawingController(surface, store, () => ctxRef.current, () => scopeRef.current);
      return bindDrawings(surface, store, controller, () => ctxRef.current);
    });
    return () => chart.setSurfaceClient(null);
  }, [chart, store]);

  useEffect(() => {
    if (!ready) store.setTool(null);
  }, [ready, store]);

  return (
    <div className="flex min-h-0 flex-1">
      <DrawingToolbar store={store} ready={ready} listOpen={listOpen} onToggleList={() => setListOpen((open) => !open)} onClearRequest={() => setConfirmClear(true)} />
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {children}
        {load === "loading" ? <span className="pointer-events-none absolute bottom-8 left-2 z-10 text-[10px] text-muted">Loading drawings…</span> : null}
        {load === "error" ? (
          <div role="alert" className="absolute bottom-8 left-2 z-20 flex items-center gap-2 rounded-md border border-[var(--color-danger-light)] bg-negative-soft px-2 py-1 text-[11px] text-negative">
            Drawings couldn’t be loaded.
            <button type="button" onClick={() => void retryLoad()} className="font-semibold underline-offset-2 hover:underline">
              Retry
            </button>
          </div>
        ) : (
          <SaveStatus phase={save} error={error} onRetry={() => void retrySave()} />
        )}
        {listOpen ? <ObjectList store={store} onClose={() => setListOpen(false)} /> : null}
        {ready ? <DrawingProperties store={store} ctx={context} bars={() => chart?.bars() ?? []} unit={sizeUnit} onSimulate={onSimulate} /> : null}
        {confirmClear ? (
          <div role="alertdialog" aria-label="Remove all drawings" className="absolute left-2 bottom-12 z-30 w-60 rounded-xl border border-border bg-surface p-3 shadow-lg">
            <p className="text-xs text-foreground">Remove all {store.drawings.length} drawings on this chart? You can undo this.</p>
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" className="dash-btn-secondary text-xs" onClick={() => setConfirmClear(false)} autoFocus>
                Cancel
              </button>
              <button
                type="button"
                className="dash-btn-primary text-xs"
                onClick={() => {
                  const count = store.drawings.length;
                  store.clear();
                  setConfirmClear(false);
                  toast.success("Drawings removed", `${count} removed. Press Ctrl+Z to undo.`);
                }}
              >
                Remove all
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
