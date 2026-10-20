"use client";

import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import type { ReactNode } from "react";

import { money } from "@/lib/backtest/sessions";
import { TIMEFRAMES, speedLabel } from "@/lib/backtest/timeframes";
import type { ReplaySpeed, ReplayState, Timeframe } from "@/lib/backtest/types";

import { AutosaveIndicator } from "./AutosaveIndicator";
import type { SavePhase } from "./useSessionPersistence";

const SELECT =
  "h-8 rounded-lg border border-border bg-surface px-2 text-xs font-medium text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30";

export function SessionTopBar({
  symbol,
  timeframe,
  status,
  balance,
  equity,
  floating,
  currency,
  finished,
  canRewind,
  confirming,
  onFinish,
  onConfirmFinish,
  onCancelFinish,
  replay,
  onToggle,
  onStep,
  onStepBack,
  onSpeed,
  onTimeframe,
  savePhase,
  saveDetail,
}: {
  symbol: string;
  timeframe: string;
  status: string;
  balance: number;
  equity: number;
  floating: number;
  currency: string;
  finished: boolean;
  canRewind: boolean;
  confirming: boolean;
  onFinish: () => void;
  onConfirmFinish: () => void;
  onCancelFinish: () => void;
  replay: ReplayState | null;
  onToggle: () => void;
  onStep: () => void;
  onStepBack: () => void;
  onSpeed: (speed: ReplaySpeed) => void;
  onTimeframe: (timeframe: Timeframe) => void;
  savePhase: SavePhase;
  saveDetail: string | null;
}) {
  const playing = replay?.status === "playing";
  const transportDisabled = !replay || finished;

  return (
    <div className="dash-card flex flex-wrap items-center gap-x-4 gap-y-3 px-3 py-2.5">
      <div className="flex min-w-[9.5rem] items-center gap-2.5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight text-foreground">{symbol}</h2>
            <span className="rounded-md bg-[hsl(var(--surface-2))] px-1.5 py-0.5 text-[11px] font-medium text-muted">{timeframe}</span>
          </div>
          <StatusPill status={status} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:border-l sm:border-border sm:pl-4">
        <Metric label="Balance" value={money(balance, currency)} />
        <Metric label="Equity" value={money(equity, currency)} />
        <Metric label="Floating" value={money(floating, currency)} tone={floating > 0 ? "up" : floating < 0 ? "down" : "flat"} />
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <AutosaveIndicator phase={savePhase} detail={saveDetail} />
        <div className="flex items-center rounded-lg border border-border bg-[hsl(var(--surface-2))] p-0.5" role="group" aria-label="Playback">
          <TransportButton label="Step back one minute" title={canRewind ? "Step back one minute" : "Close the open position before stepping back"} onClick={onStepBack} disabled={!canRewind || finished}>
            <SkipBack className="h-3.5 w-3.5" />
          </TransportButton>
          <button
            type="button"
            className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-40 ${
              playing ? "bg-surface text-foreground" : "bg-primary text-on-accent"
            }`}
            onClick={onToggle}
            disabled={transportDisabled}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {playing ? "Pause" : "Play"}
          </button>
          <TransportButton label="Step forward one minute" onClick={onStep} disabled={finished}>
            <SkipForward className="h-3.5 w-3.5" />
          </TransportButton>
        </div>

        <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
          Speed
          <select
            className={SELECT}
            value={replay?.speed ?? 10}
            onChange={(event) => {
              const value = event.target.value;
              onSpeed(value === "candle" ? "candle" : (Number(value) as ReplaySpeed));
            }}
            aria-label="Speed"
          >
            {[1, 2, 5, 10, 20, 50, 100].map((speed) => (
              <option key={speed} value={speed}>
                {speedLabel(speed as ReplaySpeed)}
              </option>
            ))}
            <option value="candle">{speedLabel("candle")}</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
          Chart
          <select
            className={SELECT}
            value={replay?.timeframe ?? timeframe}
            onChange={(event) => onTimeframe(event.target.value as Timeframe)}
            aria-label="Timeframe"
          >
            {TIMEFRAMES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        {finished ? (
          <span className="rounded-lg bg-[hsl(var(--surface-2))] px-2.5 py-1.5 text-xs font-medium text-muted">Finished</span>
        ) : confirming ? (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-[hsl(var(--surface-2))] px-2 py-1">
            <span className="text-xs text-foreground">End at the current price?</span>
            <button type="button" className="dash-btn-primary h-7 px-2.5 text-xs" onClick={onConfirmFinish}>
              Finish
            </button>
            <button type="button" className="h-7 px-1.5 text-xs font-medium text-muted hover:text-foreground" onClick={onCancelFinish}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className="dash-btn-secondary h-8 px-3 text-xs" onClick={onFinish}>
            Finish
          </button>
        )}
      </div>
    </div>
  );
}

function TransportButton({
  label,
  title,
  disabled,
  onClick,
  children,
}: {
  label: string;
  title?: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-40"
      aria-label={label}
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  const playing = status === "playing";
  const problem = status === "error";
  const label = status === "playing" ? "Playing" : status === "paused" ? "Paused" : status === "finished" ? "Finished" : status === "error" ? "Data issue" : status === "ended" ? "End of data" : "Loading";
  const dot = playing ? "bg-[var(--color-success-text)]" : problem ? "bg-[var(--color-danger-text)]" : "bg-muted";
  return (
    <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${dot} ${playing ? "motion-safe:animate-pulse" : ""}`} aria-hidden />
      {label}
    </p>
  );
}

function Metric({ label, value, tone = "flat" }: { label: string; value: string; tone?: "up" | "down" | "flat" }) {
  const color = tone === "up" ? "text-[var(--color-success-text)]" : tone === "down" ? "text-[var(--color-danger-text)]" : "text-foreground";
  return (
    <div className="min-w-[5.5rem]">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className={`font-mono text-sm tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
