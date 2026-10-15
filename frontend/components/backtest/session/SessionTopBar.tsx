"use client";

import { Pause, Play, SkipBack, SkipForward } from "lucide-react";

import { money } from "@/lib/backtest/sessions";
import { TIMEFRAMES, speedLabel } from "@/lib/backtest/timeframes";
import type { ReplaySpeed, ReplayState, Timeframe } from "@/lib/backtest/types";

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
}) {
  return (
    <div className="dash-card flex flex-wrap items-center gap-3 p-3">
      <div className="min-w-[140px]">
        <div className="text-sm font-semibold text-foreground">
          {symbol} <span className="font-normal text-muted">{timeframe}</span>
        </div>
        <div className="text-xs capitalize text-muted">{status}</div>
      </div>
      <Metric label="Balance" value={money(balance, currency)} />
      <Metric label="Equity" value={money(equity, currency)} />
      <Metric label="Floating" value={money(floating, currency)} tone={floating > 0 ? "up" : floating < 0 ? "down" : "flat"} />
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <button type="button" className="dash-btn-secondary h-8 px-2" onClick={onToggle} disabled={!replay || finished} aria-label={replay?.status === "playing" ? "Pause" : "Play"}>
          {replay?.status === "playing" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button type="button" className="dash-btn-secondary h-8 px-2" onClick={onStepBack} disabled={!canRewind || finished} aria-label="Step back">
          <SkipBack className="h-4 w-4" />
        </button>
        <button type="button" className="dash-btn-secondary h-8 px-2" onClick={onStep} disabled={finished} aria-label="Step forward">
          <SkipForward className="h-4 w-4" />
        </button>
        <select
          className="h-8 rounded-md border border-border bg-surface px-2 text-xs"
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
        <select
          className="h-8 rounded-md border border-border bg-surface px-2 text-xs"
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
        {finished ? null : confirming ? (
          <span className="flex items-center gap-2 text-xs">
            <span className="text-muted">Close the session?</span>
            <button type="button" className="text-primary" onClick={onConfirmFinish}>
              Finish
            </button>
            <button type="button" className="text-muted" onClick={onCancelFinish}>
              Cancel
            </button>
          </span>
        ) : (
          <button type="button" className="dash-btn-primary text-on-accent h-8 px-3 text-xs" onClick={onFinish}>
            Finish
          </button>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, tone = "flat" }: { label: string; value: string; tone?: "up" | "down" | "flat" }) {
  const color = tone === "up" ? "text-positive" : tone === "down" ? "text-negative" : "text-foreground";
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`font-mono text-sm ${color}`}>{value}</div>
    </div>
  );
}
