"use client";

import { Maximize2, Minimize2, Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { REPLAY_SPEEDS, TIMEFRAMES, speedLabel } from "@/lib/backtest/timeframes";
import type { ReplaySpeed, ReplayState, Timeframe } from "@/lib/backtest/types";

const selectClass =
  "h-8 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-xs text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-hex)]";

export function ReplayControls({
  state,
  scrubMs,
  onScrub,
  onScrubEnd,
  onToggle,
  onStep,
  onStepCandle,
  onStepBack,
  onSpeed,
  onTimeframe,
  onJump,
  onReset,
  onFullscreen,
  fullscreen,
}: {
  state: ReplayState;
  scrubMs: number;
  onScrub: (ms: number) => void;
  onScrubEnd: (ms: number) => void;
  onToggle: () => void;
  onStep: (direction: "back" | "forward") => void;
  onStepCandle: () => void;
  onStepBack: () => void;
  onSpeed: (speed: ReplaySpeed) => void;
  onTimeframe: (timeframe: Timeframe) => void;
  onJump: (target: "entry" | "exit") => void;
  onReset: () => void;
  onFullscreen: () => void;
  fullscreen: boolean;
}) {
  const busy = state.status === "loading" || state.status === "idle";
  const playing = state.status === "playing" || state.status === "buffering";
  const span = Math.max(state.endMs - state.minMs, 60_000);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant={playing ? "secondary" : "primary"} onClick={onToggle} disabled={busy || state.status === "ended"} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {playing ? "Pause" : "Play"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onStepBack} disabled={busy} aria-label="Step back one minute">
          <SkipBack className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onStep("forward")} disabled={busy || state.status === "ended"} aria-label="Step forward one minute">
          <SkipForward className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onStepCandle} disabled={busy || state.status === "ended"}>
          +1 candle
        </Button>
        <label className="ml-1 flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
          Speed
          <select
            className={selectClass}
            value={String(state.speed)}
            aria-label="Replay speed"
            onChange={(event) => {
              const value = event.target.value;
              onSpeed(value === "candle" ? "candle" : (Number(value) as ReplaySpeed));
            }}
          >
            {REPLAY_SPEEDS.map((speed) => (
              <option key={String(speed)} value={String(speed)}>
                {speedLabel(speed)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
          Timeframe
          <select
            className={selectClass}
            value={state.timeframe}
            aria-label="Chart timeframe"
            onChange={(event) => onTimeframe(event.target.value as Timeframe)}
          >
            {TIMEFRAMES.map((tf) => (
              <option key={tf} value={tf}>
                {tf}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => onJump("entry")}>
            Entry
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onJump("exit")}>
            Exit
          </Button>
          <Button size="sm" variant="ghost" onClick={onReset} aria-label="Reset replay">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onFullscreen} aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
      <input
        type="range"
        className="h-1.5 w-full cursor-pointer accent-[var(--accent-hex)] disabled:cursor-not-allowed"
        min={0}
        max={span}
        step={60_000}
        value={Math.min(Math.max(scrubMs - state.minMs, 0), span)}
        aria-label="Scrub replay"
        aria-valuetext={new Date(scrubMs).toISOString()}
        disabled={busy}
        onChange={(event) => onScrub(state.minMs + Number(event.target.value))}
        onPointerUp={(event) => onScrubEnd(state.minMs + Number((event.target as HTMLInputElement).value))}
        onKeyUp={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "Home" || event.key === "End") {
            onScrubEnd(state.minMs + Number((event.target as HTMLInputElement).value));
          }
        }}
      />
      <p className="text-[11px] text-[var(--color-text-muted)]">
        Space play/pause · ← → step · + − speed
        {state.status === "buffering" ? " · Loading candles…" : ""}
        {state.status === "ended" ? " · End of available data." : ""}
      </p>
    </div>
  );
}
