"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

import {
  ChartModel,
  DEFAULT_MAX_BARS,
  attachChart,
  observeElementSize,
  type CandleBar,
  type ChartMarker,
  type ChartPriceLine,
  type SurfaceClient,
} from "./chartModel";
import { readChartTheme, subscribeThemeChanges, type ChartTheme } from "./chartTheme";
import { UTC_ZONE, formatCrosshairTime, safeTimeZone, timeZoneLabel } from "./chartTime";
import { createLightweightBackend } from "./lightweightBackend";

export type CandleChartHandle = {
  setHistory: (bars: readonly CandleBar[]) => void;
  updateLast: (bar: CandleBar) => boolean;
  setMarkers: (markers: readonly ChartMarker[]) => void;
  setPriceLine: (line: ChartPriceLine) => void;
  removePriceLine: (id: string) => void;
  clearPriceLines: () => void;
  scrollTo: (timeMs: number) => void;
  fit: () => void;
  bars: () => readonly CandleBar[];
  theme: () => ChartTheme;
  timeToX: (timeMs: number) => number | null;
  onRange: (listener: () => void) => () => void;
  /** Attach the drawing layer. Survives chart remounts until cleared with null. */
  setSurfaceClient: (client: SurfaceClient | null) => void;
};

export type CandleChartProps = {
  timeZone: string;
  priceDecimals: number;
  showVolume?: boolean;
  maxBars?: number;
  ariaLabel: string;
  className?: string;
};

function LegendValue({ label, value }: { label: string; value: string }) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-[var(--color-text-muted)]">{label}</span>{" "}
      <span className="font-medium tabular-nums text-[var(--color-text-primary)]">{value}</span>
    </span>
  );
}

export const CandleChart = forwardRef<CandleChartHandle, CandleChartProps>(function CandleChart(
  { timeZone, priceDecimals, showVolume = false, maxBars = DEFAULT_MAX_BARS, ariaLabel, className = "" },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [useUtc, setUseUtc] = useState(false);
  const userZone = safeTimeZone(timeZone);
  const activeZone = useUtc ? UTC_ZONE : userZone;
  const modelRef = useRef<ChartModel | null>(null);
  if (!modelRef.current) {
    modelRef.current = new ChartModel(
      { theme: readChartTheme(), timeZone: activeZone, priceDecimals, showVolume },
      maxBars
    );
  }
  const [legend, setLegend] = useState<CandleBar | null>(null);
  const hoverRef = useRef<CandleBar | null>(null);

  useImperativeHandle(ref, () => {
    const model = modelRef.current!;
    return {
      setHistory: (bars) => model.setHistory(bars),
      updateLast: (bar) => model.updateLast(bar),
      setMarkers: (markers) => model.setMarkers(markers),
      setPriceLine: (line) => model.setPriceLine(line),
      removePriceLine: (id) => model.removePriceLine(id),
      clearPriceLines: () => model.clearPriceLines(),
      scrollTo: (timeMs) => model.scrollTo(timeMs),
      fit: () => model.fit(),
      bars: () => model.getBars(),
      theme: () => model.display.theme,
      timeToX: (timeMs) => model.timeToX(timeMs),
      onRange: (listener) => model.onRange(listener),
      setSurfaceClient: (client) => model.setSurfaceClient(client),
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const model = modelRef.current;
    if (!container || !model) return;
    let frame = 0;
    const refreshLegend = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setLegend(hoverRef.current ?? model.lastBar());
      });
    };
    const stopModel = model.subscribe(refreshLegend);
    const detach = attachChart({
      container,
      model,
      createBackend: createLightweightBackend,
      readTheme: () => readChartTheme(),
      observeResize: observeElementSize,
      subscribeTheme: subscribeThemeChanges,
      onCrosshair: (bar) => {
        hoverRef.current = bar;
        refreshLegend();
      },
    });
    refreshLegend();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      stopModel();
      detach();
      hoverRef.current = null;
    };
  }, []);

  useEffect(() => {
    modelRef.current?.setDisplay({ timeZone: activeZone, priceDecimals, showVolume });
  }, [activeZone, priceDecimals, showVolume]);

  const fmt = (value: number) => value.toFixed(priceDecimals);
  const change = legend ? legend.close - legend.open : 0;

  return (
    <div className={`relative flex h-full min-h-0 w-full flex-col ${className}`}>
      <div
        className="pointer-events-none absolute left-2 top-2 z-10 flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-md px-2 py-1 text-[11px] backdrop-blur-sm"
        style={{ background: "color-mix(in srgb, var(--color-surface) 85%, transparent)" }}
      >
        {legend ? (
          <>
            <span className="text-[var(--color-text-secondary)]">{formatCrosshairTime(legend.time, activeZone)}</span>
            <LegendValue label="O" value={fmt(legend.open)} />
            <LegendValue label="H" value={fmt(legend.high)} />
            <LegendValue label="L" value={fmt(legend.low)} />
            <LegendValue label="C" value={fmt(legend.close)} />
            <span
              className="tabular-nums font-medium"
              style={{ color: change >= 0 ? "var(--color-pnl-positive, var(--color-success-text))" : "var(--color-pnl-negative, var(--color-danger-text))" }}
            >
              {change >= 0 ? "▲" : "▼"} {fmt(Math.abs(change))}
            </span>
          </>
        ) : (
          <span className="text-[var(--color-text-muted)]">No candles loaded</span>
        )}
      </div>
      <div ref={containerRef} role="img" aria-label={ariaLabel} className="min-h-0 w-full flex-1" />
      <div className="flex h-6 shrink-0 items-center justify-between gap-2 px-2 text-[10px] text-[var(--color-text-muted)]">
        <button
          type="button"
          onClick={() => setUseUtc((v) => !v)}
          aria-pressed={useUtc}
          title={useUtc ? `Show times in ${userZone}` : "Show times in UTC"}
          className="rounded px-1 py-0.5 font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-hex)]"
        >
          Times in {timeZoneLabel(activeZone)} · {useUtc ? "use my timezone" : "switch to UTC"}
        </button>
        <span>
          Charts by{" "}
          <a
            href="https://www.tradingview.com/lightweight-charts/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 hover:underline"
          >
            TradingView Lightweight Charts™
          </a>
          {" · "}
          <a href="/notices" className="underline-offset-2 hover:underline">
            Notices
          </a>
        </span>
      </div>
    </div>
  );
});
