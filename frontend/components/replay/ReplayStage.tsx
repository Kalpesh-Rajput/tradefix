"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CandleChart, type CandleChartHandle } from "@/components/chart";
import { DrawingChartFrame } from "@/components/chart/drawings/DrawingChartFrame";
import { readChartTheme } from "@/components/chart/chartTheme";
import { ApiError } from "@/lib/api";
import type { ReplayPayload } from "@/lib/backtest/marketClient";
import { ReplayEngine } from "@/lib/backtest/replayEngine";
import { isTimeframe, nextSpeed } from "@/lib/backtest/timeframes";
import type { Candle, ReplaySpeed, ReplayState, Timeframe } from "@/lib/backtest/types";
import { useCandleSource } from "@/lib/hooks/useCandles";
import { useReplayNotes } from "@/lib/hooks/useReplay";

import { AlignmentBanner } from "./AlignmentBanner";
import { ReplayControls } from "./ReplayControls";
import {
  PRICE_LINE_IDS,
  exitSpan,
  floatingResult,
  overlayLines,
  overlayMarkers,
  shiftCandle,
  type FloatingResult,
  type OverlayNote,
} from "./ReplayOverlays";
import { ReplayStates } from "./ReplayStates";
import { ReplaySidePanel, noteError } from "./ReplaySidePanel";
import { useReplayShortcuts, type ReplayShortcutActions } from "./useReplayShortcuts";

function sameShade(
  current: { left: number; width: number } | null,
  next: { left: number; width: number } | null,
): boolean {
  if (current === next) return true;
  if (!current || !next) return false;
  return current.left === next.left && current.width === next.width;
}

function sameBadge(current: FloatingResult | null, next: FloatingResult | null): boolean {
  if (current === next) return true;
  if (!current || !next) return false;
  return current.pips === next.pips && current.r === next.r && current.settled === next.settled;
}

const INITIAL: ReplayState = {
  status: "idle",
  cursorMs: 0,
  timeframe: "1m",
  speed: 10,
  minMs: 0,
  endMs: 0,
  error: null,
};

export function ReplayStage({ payload, timeZone }: { payload: ReplayPayload; timeZone: string }) {
  const source = useCandleSource(payload.instrument.symbol);
  const notesQuery = useReplayNotes(payload.trade_ref, payload.source === "journal");
  const chartRef = useRef<CandleChartHandle | null>(null);
  const candlesRef = useRef<readonly Candle[]>([]);
  const engineRef = useRef<ReplayEngine | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const deltaRef = useRef(0);
  const notesRef = useRef<OverlayNote[]>([]);
  const rangeRef = useRef<(() => void) | null>(null);
  const [state, setState] = useState<ReplayState>(INITIAL);
  const [chartHandle, setChartHandle] = useState<CandleChartHandle | null>(null);
  const [scrubMs, setScrubMs] = useState<number | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const [aligned, setAligned] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [badge, setBadge] = useState<FloatingResult | null>(null);
  const [shade, setShade] = useState<{ left: number; width: number } | null>(null);
  const badgeRef = useRef(badge);
  const shadeRef = useRef(shade);
  badgeRef.current = badge;
  shadeRef.current = shade;
  const [noteErrorText, setNoteErrorText] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const suggestion = payload.alignment?.offset_suggestion ?? null;
  notesRef.current = notesQuery.notes.map((note) => ({ id: note.id, timeMs: note.replay_time_ms, text: note.text }));

  const paintRef = useRef<() => void>(() => {});
  paintRef.current = () => {
    const chart = chartRef.current;
    const engine = engineRef.current;
    if (!chart || !engine) return;
    const cursor = engine.getState().cursorMs;
    const trade = {
      side: payload.trade.side,
      entryMs: payload.trade.entry_ms,
      entryPrice: payload.trade.entry_price,
      exitMs: payload.trade.exit_ms,
      exitPrice: payload.trade.exit_price,
      stopLoss: payload.trade.stop_loss,
      takeProfit: payload.trade.take_profit,
    };
    const theme = chart.theme();
    chart.setMarkers(overlayMarkers(trade, cursor, notesRef.current, theme));
    const lines = overlayLines(trade, cursor, deltaRef.current, theme);
    const ids = new Set(lines.map((line) => line.id));
    for (const line of lines) chart.setPriceLine(line);
    for (const id of PRICE_LINE_IDS) if (!ids.has(id)) chart.removePriceLine(id);
    const span = exitSpan(trade, cursor);
    let nextShade: { left: number; width: number } | null = null;
    if (span) {
      const from = chart.timeToX(span.from);
      const to = chart.timeToX(span.to);
      if (from != null && to != null) nextShade = { left: Math.min(from, to), width: Math.abs(to - from) };
    }
    if (!sameShade(shadeRef.current, nextShade)) {
      shadeRef.current = nextShade;
      setShade(nextShade);
    }
    const nextBadge = floatingResult(trade, cursor, candlesRef.current, payload.instrument.pip_size);
    if (!sameBadge(badgeRef.current, nextBadge)) {
      badgeRef.current = nextBadge;
      setBadge(nextBadge);
    }
  };

  const show = (candles: readonly Candle[]) => candles.map((candle) => shiftCandle(candle, deltaRef.current));

  const bindChart = useCallback((handle: CandleChartHandle | null) => {
    rangeRef.current?.();
    rangeRef.current = null;
    chartRef.current = handle;
    setChartHandle(handle);
    if (!handle) return;
    if (candlesRef.current.length) handle.setHistory(candlesRef.current.map((candle) => shiftCandle(candle, deltaRef.current)));
    rangeRef.current = handle.onRange(() => paintRef.current());
    paintRef.current();
  }, []);

  useEffect(() => {
    if (!source) return;
    const timeframe = isTimeframe(payload.default_timeframe) ? payload.default_timeframe : "1m";
    const engine = new ReplayEngine({
      source,
      timeframe,
      startMs: payload.suggested_start_ms,
      minMs: payload.window_start_ms,
      endMs: payload.window_end_ms,
      speed: 10,
    });
    engineRef.current = engine;
    let frame = 0;
    let pending: ReplayState | null = null;
    const stop = engine.subscribe((event) => {
      const chart = chartRef.current;
      if (event.type === "reset") {
        candlesRef.current = event.candles;
        chart?.setHistory(show(event.candles));
        paintRef.current();
      } else if (event.type === "candles") {
        for (const candle of event.candles) chart?.updateLast(shiftCandle(candle, deltaRef.current));
        candlesRef.current = engine.candles();
        paintRef.current();
      } else if (event.type === "state") {
        pending = event.state;
        if (event.state.status === "error") {
          setFailure(new ApiError(event.state.error || "Market data could not be loaded.", 0, { code: "network" }));
        } else setFailure(null);
        if (!frame) {
          frame = requestAnimationFrame(() => {
            frame = 0;
            if (pending) setState(pending);
          });
        }
      }
    });
    void engine.load();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      stop();
      engine.destroy();
      engineRef.current = null;
    };
  }, [source, payload.default_timeframe, payload.suggested_start_ms, payload.window_start_ms, payload.window_end_ms]);

  useEffect(() => {
    paintRef.current();
  }, [notesQuery.notes]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const shortcuts = useMemo<ReplayShortcutActions>(
    () => ({
      toggle: () => engineRef.current?.toggle(),
      stepForward: () => void engineRef.current?.stepMinute(),
      stepBack: () => void engineRef.current?.stepBack("minute"),
      faster: () => engineRef.current?.setSpeed(nextSpeed(stateRef.current.speed, 1)),
      slower: () => engineRef.current?.setSpeed(nextSpeed(stateRef.current.speed, -1)),
    }),
    []
  );
  useReplayShortcuts(shortcuts);

  const shown = scrubMs ?? state.cursorMs;
  const theme = chartRef.current?.theme() ?? readChartTheme();
  const badgeColor = !badge ? theme.text : badge.pips >= 0 ? theme.up : theme.down;

  return (
    <div ref={shellRef} className="flex min-h-0 flex-1 flex-col gap-3 bg-[var(--color-surface)]">
      {suggestion ? (
        <AlignmentBanner
          points={suggestion.points}
          aligned={aligned}
          dismissed={dismissed}
          onDismiss={() => setDismissed(true)}
          onToggle={() => {
            const next = !aligned;
            setAligned(next);
            deltaRef.current = next ? suggestion.price_delta : 0;
            const chart = chartRef.current;
            if (chart) chart.setHistory(show(candlesRef.current));
            paintRef.current();
          }}
        />
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          <div className="flex min-h-[420px] flex-1 overflow-hidden rounded-xl border border-[var(--color-border)]">
            <DrawingChartFrame
              chart={chartHandle}
              workspace={`replay:${payload.trade_ref}`}
              symbol={payload.instrument.symbol}
              timeframe={state.timeframe}
              context={{
                priceDecimals: payload.instrument.price_decimals,
                pipSize: payload.instrument.pip_size,
                assetClass: payload.instrument.asset_class,
                quoteCurrency: payload.instrument.quote_currency,
              }}
              sizeUnit={payload.instrument.asset_class === "crypto" ? "units" : "lots"}
            >
            {shade ? (
              <div
                aria-hidden
                className="pointer-events-none absolute bottom-6 top-0 z-[1]"
                style={{ left: shade.left, width: shade.width, background: "color-mix(in srgb, var(--accent-hex) 12%, transparent)" }}
              />
            ) : null}
            {badge ? (
              <div
                className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-md px-2 py-1 text-[11px] font-semibold tabular-nums"
                style={{ color: badgeColor, background: "color-mix(in srgb, var(--color-surface) 88%, transparent)" }}
              >
                {badge.settled ? "Result" : "Open"} {badge.pips >= 0 ? "+" : "−"}
                {Math.abs(badge.pips).toFixed(1)} pips
                {badge.r != null ? ` · ${badge.r >= 0 ? "+" : "−"}${Math.abs(badge.r).toFixed(2)} R` : ""}
              </div>
            ) : null}
            <CandleChart
              ref={bindChart}
              timeZone={timeZone}
              priceDecimals={payload.instrument.price_decimals}
              showVolume={payload.instrument.asset_class === "crypto"}
              ariaLabel={`${payload.instrument.symbol} replay chart`}
              className="min-h-0 flex-1"
            />
            {state.status === "loading" ? <div className="pointer-events-none absolute inset-0 animate-pulse bg-[var(--color-border-subtle)]/40" aria-hidden /> : null}
            </DrawingChartFrame>
          </div>
          {failure ? (
            <ReplayStates
              error={failure}
              onRetry={() => {
                setFailure(null);
                void engineRef.current?.retry();
              }}
            />
          ) : (
            <ReplayControls
              state={state}
              scrubMs={shown}
              fullscreen={fullscreen}
              onScrub={(ms) => {
                engineRef.current?.pause();
                setScrubMs(ms);
              }}
              onScrubEnd={(ms) => {
                setScrubMs(null);
                void engineRef.current?.seek(ms);
              }}
              onToggle={() => engineRef.current?.toggle()}
              onStep={() => void engineRef.current?.stepMinute()}
              onStepCandle={() => void engineRef.current?.stepCandle()}
              onStepBack={() => void engineRef.current?.stepBack("minute")}
              onSpeed={(speed: ReplaySpeed) => engineRef.current?.setSpeed(speed)}
              onTimeframe={(timeframe: Timeframe) => void engineRef.current?.setTimeframe(timeframe)}
              onJump={(target) => {
                const ms = target === "entry" ? payload.trade.entry_ms : payload.trade.exit_ms;
                if (ms != null) void engineRef.current?.seek(ms);
              }}
              onReset={() => void engineRef.current?.reset()}
              onFullscreen={() => {
                const node = shellRef.current;
                if (!node) return;
                if (document.fullscreenElement === node) void document.exitFullscreen();
                else void node.requestFullscreen();
              }}
            />
          )}
        </div>
        <ReplaySidePanel
          notes={notesQuery.notes}
          timeZone={timeZone}
          cursorMs={state.cursorMs}
          saving={notesQuery.saving}
          error={noteErrorText}
          onJump={(timeMs) => void engineRef.current?.seek(timeMs)}
          onAdd={async (text) => {
            setNoteErrorText(null);
            try {
              await notesQuery.addNote({ replay_time_ms: stateRef.current.cursorMs, text });
            } catch (error) {
              setNoteErrorText(noteError(error));
              throw error;
            }
          }}
        />
      </div>
    </div>
  );
}
