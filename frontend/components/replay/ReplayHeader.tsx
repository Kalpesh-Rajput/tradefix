"use client";

import type { ReplayPayload } from "@/lib/backtest/marketClient";
import { formatCrosshairTime } from "@/components/chart/chartTime";

function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 48) return rest ? `${hours}h ${rest}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const hourRest = hours % 24;
  return hourRest ? `${days}d ${hourRest}h` : `${days}d`;
}

function signed(value: number, digits: number): string {
  const text = Math.abs(value).toFixed(digits);
  return value > 0 ? `+${text}` : value < 0 ? `−${text}` : text;
}

export function tradeExcursion(payload: ReplayPayload): { pips: number | null; r: number | null } {
  const { trade, instrument } = payload;
  if (trade.exit_price == null || instrument.pip_size <= 0) return { pips: null, r: null };
  const direction = trade.side === "long" ? 1 : -1;
  const move = (trade.exit_price - trade.entry_price) * direction;
  const pips = move / instrument.pip_size;
  let r: number | null = null;
  if (trade.stop_loss != null) {
    const risk = (trade.entry_price - trade.stop_loss) * direction;
    if (risk > 0) r = move / risk;
  }
  return { pips, r };
}

export function priceMovePercent(payload: ReplayPayload): number | null {
  const { trade } = payload;
  if (trade.exit_price == null || trade.entry_price <= 0) return null;
  const direction = trade.side === "long" ? 1 : -1;
  return (((trade.exit_price - trade.entry_price) * direction) / trade.entry_price) * 100;
}

function Stat({ label, value, sub, hint }: { label: string; value: string; sub?: string; hint?: string }) {
  return (
    <div className="min-w-0 sm:border-l sm:border-[var(--color-border)] sm:pl-5" title={hint}>
      <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{label}</div>
      <div className="truncate text-sm font-semibold tabular-nums text-[var(--color-text-primary)]">{value}</div>
      {sub ? <div className="truncate text-[11px] tabular-nums text-[var(--color-text-muted)]">{sub}</div> : null}
    </div>
  );
}

export function ReplayHeader({ payload, timeZone }: { payload: ReplayPayload; timeZone: string }) {
  const { trade, instrument } = payload;
  const digits = instrument.price_decimals;
  const result = tradeExcursion(payload);
  const move = priceMovePercent(payload);
  const duration = trade.exit_ms != null ? formatDuration(trade.exit_ms - trade.entry_ms) : "Open";
  const positive = "var(--color-pnl-positive, var(--color-success-text))";
  const negative = "var(--color-pnl-negative, var(--color-danger-text))";
  const tone = result.pips == null ? "var(--color-text-secondary)" : result.pips >= 0 ? positive : negative;
  const long = trade.side === "long";

  return (
    <header className="grid gap-x-5 gap-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 sm:grid-cols-2 lg:grid-cols-[minmax(9rem,1.1fr)_repeat(4,minmax(0,1fr))]">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">{instrument.symbol}</h1>
          <span
            className="rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: long ? positive : negative, borderColor: "currentColor" }}
          >
            {trade.side}
          </span>
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">Size {trade.size}</p>
      </div>
      <Stat label="Entry" value={trade.entry_price.toFixed(digits)} sub={formatCrosshairTime(trade.entry_ms, timeZone)} />
      <Stat
        label="Exit"
        value={trade.exit_price != null ? trade.exit_price.toFixed(digits) : "Still open"}
        sub={trade.exit_ms != null ? formatCrosshairTime(trade.exit_ms, timeZone) : "No exit recorded"}
      />
      <Stat label="Duration" value={duration} hint="Time between entry and exit" />
      <div className="min-w-0 sm:border-l sm:border-[var(--color-border)] sm:pl-5" title="Pips = price move in the trade direction ÷ pip size. R = move ÷ initial stop distance. Move % = price move ÷ entry price.">
        <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Result</div>
        <div className="truncate text-sm font-semibold tabular-nums" style={{ color: tone }}>
          {result.pips == null ? "" : `${signed(result.pips, 1)} pips`}
          {result.r != null ? ` · ${signed(result.r, 2)} R` : ""}
        </div>
        <div className="truncate text-[11px] tabular-nums text-[var(--color-text-muted)]">
          {move == null ? "Awaiting exit" : `${signed(move, 2)}% price move`}
        </div>
      </div>
    </header>
  );
}
