"use client";

import { useEffect, useRef, useState } from "react";

import { CandleChart, type CandleChartHandle } from "@/components/chart";
import { ApiError } from "@/lib/api";
import { ReplayEngine } from "@/lib/backtest/replayEngine";
import type { ReplayPayload } from "@/lib/backtest/marketClient";
import { isTimeframe } from "@/lib/backtest/timeframes";
import type { Candle, ReplaySpeed, ReplayState, Timeframe } from "@/lib/backtest/types";
import { useCandleSource } from "@/lib/hooks/useCandles";

import { ReplayControls } from "./ReplayControls";
import { ReplayStates } from "./ReplayStates";

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
  const chartRef = useRef<CandleChartHandle | null>(null);
  const candlesRef = useRef<readonly Candle[]>([]);
  const engineRef = useRef<ReplayEngine | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<ReplayState>(INITIAL);
  const [scrubMs, setScrubMs] = useState<number | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [failure, setFailure] = useState<ApiError | null>(null);

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
      if (event.type === "reset") {
        candlesRef.current = event.candles;
        chartRef.current?.setHistory(event.candles);
      } else if (event.type === "candles") {
        for (const candle of event.candles) chartRef.current?.updateLast(candle);
        candlesRef.current = engine.candles();
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
    const onChange = () => setFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const shown = scrubMs ?? state.cursorMs;

  return (
    <div ref={shellRef} className="flex min-h-0 flex-1 flex-col gap-3 bg-[var(--color-surface)]">
      <div className="relative min-h-[420px] flex-1 overflow-hidden rounded-xl border border-[var(--color-border)]">
        <CandleChart
          ref={(handle) => {
            chartRef.current = handle;
            if (handle && candlesRef.current.length) handle.setHistory(candlesRef.current);
          }}
          timeZone={timeZone}
          priceDecimals={payload.instrument.price_decimals}
          showVolume={payload.instrument.asset_class === "crypto"}
          ariaLabel={`${payload.instrument.symbol} replay chart`}
        />
        {state.status === "loading" ? (
          <div className="pointer-events-none absolute inset-0 animate-pulse bg-[var(--color-border-subtle)]/40" aria-hidden />
        ) : null}
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
  );
}
