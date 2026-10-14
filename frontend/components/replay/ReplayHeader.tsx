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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{label}</div>
      <div className="truncate text-sm font-medium tabular-nums text-[var(--color-text-primary)]">{value}</div>
    </div>
  );
}

export function ReplayHeader({ payload, timeZone }: { payload: ReplayPayload; timeZone: string }) {
  const { trade, instrument } = payload;
  const digits = instrument.price_decimals;
  const result = tradeExcursion(payload);
  const duration = trade.exit_ms != null ? formatDuration(trade.exit_ms - trade.entry_ms) : "Open";
  const tone = result.pips == null ? "var(--color-text-secondary)" : result.pips >= 0 ? "var(--color-pnl-positive, var(--color-success-text))" : "var(--color-pnl-negative, var(--color-danger-text))";

  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <div className="min-w-[8rem]">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">{instrument.symbol}</h1>
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
            style={{ color: trade.side === "long" ? "var(--color-pnl-positive, var(--color-success-text))" : "var(--color-pnl-negative, var(--color-danger-text))" }}
          >
            {trade.side}
          </span>
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">
          {trade.size} · {duration}
        </p>
      </div>
      <Stat label="Entry" value={`${trade.entry_price.toFixed(digits)} · ${formatCrosshairTime(trade.entry_ms, timeZone)}`} />
      <Stat
        label="Exit"
        value={
          trade.exit_price != null && trade.exit_ms != null
            ? `${trade.exit_price.toFixed(digits)} · ${formatCrosshairTime(trade.exit_ms, timeZone)}`
            : "Still open"
        }
      />
      <div>
        <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Result</div>
        <div className="text-sm font-semibold tabular-nums" style={{ color: tone }}>
          {result.pips == null ? "—" : `${signed(result.pips, 1)} pips`}
          {result.r != null ? ` · ${signed(result.r, 2)} R` : ""}
        </div>
      </div>
    </header>
  );
}
