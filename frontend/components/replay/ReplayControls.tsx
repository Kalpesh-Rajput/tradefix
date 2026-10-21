"use client";

import { Keyboard, LogIn, LogOut, Maximize2, Minimize2, Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { formatCrosshairTime } from "@/components/chart/chartTime";
import { REPLAY_SPEEDS, TIMEFRAMES, speedLabel } from "@/lib/backtest/timeframes";
import type { ReplaySpeed, ReplayState, Timeframe } from "@/lib/backtest/types";

const SELECT =
  "h-8 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-xs font-medium text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-hex)]";
const ICON_BTN =
  "inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-border-subtle)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-hex)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none";
const TEXT_BTN =
  "inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-border-subtle)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-hex)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none";

export const REPLAY_SHORTCUTS: readonly { keys: string; action: string }[] = [
  { keys: "Space", action: "Play / pause" },
  { keys: "←", action: "Step back one minute" },
  { keys: "→", action: "Step forward one minute" },
  { keys: "+", action: "Faster" },
  { keys: "−", action: "Slower" },
];

function Divider() {
  return <span className="mx-1 hidden h-5 w-px bg-[var(--color-border)] sm:inline-block" aria-hidden />;
}

function percentOf(ms: number | null, min: number, span: number): number | null {
  if (ms == null || span <= 0) return null;
  const value = ((ms - min) / span) * 100;
  return value < 0 || value > 100 ? null : value;
}

function ShortcutHelp() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onDown = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button type="button" className={ICON_BTN} aria-label="Keyboard shortcuts" aria-expanded={open} aria-haspopup="dialog" title="Keyboard shortcuts" onClick={() => setOpen((value) => !value)}>
        <Keyboard className="h-4 w-4" aria-hidden />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Replay keyboard shortcuts"
          className="absolute bottom-full right-0 z-30 mb-2 w-60 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-dropdown)]"
        >
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Shortcuts</p>
          <dl className="space-y-1.5">
            {REPLAY_SHORTCUTS.map((item) => (
              <div key={item.keys} className="flex items-center justify-between gap-3 text-xs">
                <dt className="text-[var(--color-text-secondary)]">{item.action}</dt>
                <dd>
                  <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-border-subtle)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--color-text-primary)]">{item.keys}</kbd>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">Shortcuts pause while you type in a field.</p>
        </div>
      ) : null}
    </div>
  );
}

export function ReplayControls({
  state,
  scrubMs,
  timeZone,
  entryMs,
  exitMs,
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
  timeZone: string;
  entryMs: number;
  exitMs: number | null;
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
  const ended = state.status === "ended";
  const span = Math.max(state.endMs - state.minMs, 60_000);
  const position = Math.min(Math.max(scrubMs - state.minMs, 0), span);
  const entryAt = percentOf(entryMs, state.minMs, span);
  const exitAt = percentOf(exitMs, state.minMs, span);
  const message = state.status === "buffering" ? "Loading candles…" : ended ? "End of available data" : null;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5" role="group" aria-label="Replay controls">
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={onToggle}
          disabled={busy || ended}
          aria-label={playing ? "Pause" : "Play"}
          aria-keyshortcuts="Space"
          className="mr-1 inline-flex h-8 min-w-[5.25rem] items-center justify-center gap-1.5 rounded-md bg-[var(--accent-hex)] px-3 text-xs font-semibold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-hex)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
        >
          {playing ? <Pause className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
          {playing ? "Pause" : "Play"}
        </button>
        <button type="button" className={ICON_BTN} onClick={onStepBack} disabled={busy} aria-label="Step back one minute" title="Step back one minute (←)">
          <SkipBack className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" className={ICON_BTN} onClick={() => onStep("forward")} disabled={busy || ended} aria-label="Step forward one minute" title="Step forward one minute (→)">
          <SkipForward className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" className={TEXT_BTN} onClick={onStepCandle} disabled={busy || ended} title="Advance to the next candle on the chart timeframe">
          +1 candle
        </button>
        <Divider />
        <label className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-text-muted)]">
          Speed
          <select
            className={SELECT}
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
        <label className="ml-1 flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-text-muted)]">
          Timeframe
          <select className={SELECT} value={state.timeframe} aria-label="Chart timeframe" onChange={(event) => onTimeframe(event.target.value as Timeframe)}>
            {TIMEFRAMES.map((tf) => (
              <option key={tf} value={tf}>
                {tf}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex items-center gap-0.5">
          <button type="button" className={TEXT_BTN} onClick={() => onJump("entry")} disabled={busy} title="Jump to the entry">
            <LogIn className="h-3.5 w-3.5" aria-hidden />
            Entry
          </button>
          <button type="button" className={TEXT_BTN} onClick={() => onJump("exit")} disabled={busy || exitMs == null} title={exitMs == null ? "This trade has no exit yet" : "Jump to the exit"}>
            <LogOut className="h-3.5 w-3.5" aria-hidden />
            Exit
          </button>
          <Divider />
          <button type="button" className={ICON_BTN} onClick={onReset} disabled={busy} aria-label="Reset replay" title="Restart from the session start">
            <RotateCcw className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" className={ICON_BTN} onClick={onFullscreen} aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"} title={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
            {fullscreen ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
          </button>
          <ShortcutHelp />
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-3">
        <span className="hidden w-28 shrink-0 text-[11px] tabular-nums text-[var(--color-text-muted)] sm:block">{formatCrosshairTime(state.minMs, timeZone)}</span>
        <div className="relative flex h-5 min-w-0 flex-1 items-center">
          {entryAt != null ? <TimelineMark at={entryAt} label="Entry" tone="var(--accent-hex)" /> : null}
          {exitAt != null ? <TimelineMark at={exitAt} label="Exit" tone="var(--color-text-secondary)" /> : null}
          <input
            type="range"
            className="relative z-[1] h-5 w-full cursor-pointer accent-[var(--accent-hex)] disabled:cursor-not-allowed"
            min={0}
            max={span}
            step={60_000}
            value={position}
            aria-label="Scrub replay"
            aria-valuetext={formatCrosshairTime(scrubMs, timeZone)}
            disabled={busy}
            onChange={(event) => onScrub(state.minMs + Number(event.target.value))}
            onPointerUp={(event) => onScrubEnd(state.minMs + Number((event.target as HTMLInputElement).value))}
            onKeyUp={(event) => {
              if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "Home" || event.key === "End") {
                onScrubEnd(state.minMs + Number((event.target as HTMLInputElement).value));
              }
            }}
          />
        </div>
        <span className="hidden w-28 shrink-0 text-right text-[11px] tabular-nums text-[var(--color-text-muted)] sm:block">{formatCrosshairTime(state.endMs, timeZone)}</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-3 text-[11px] tabular-nums">
        <span className="font-medium text-[var(--color-text-primary)]" aria-live="off">
          {formatCrosshairTime(scrubMs, timeZone)}
        </span>
        {message ? (
          <span role="status" className="text-[var(--color-text-muted)]">
            {message}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function TimelineMark({ at, label, tone }: { at: number; label: string; tone: string }) {
  return (
    <span
      className="pointer-events-none absolute top-0 z-[2] h-2 w-0.5 -translate-x-1/2 rounded-full"
      style={{ left: `${at}%`, background: tone }}
      title={label}
      aria-hidden
    />
  );
}
