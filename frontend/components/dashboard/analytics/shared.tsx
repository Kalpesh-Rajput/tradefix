"use client";

import type { ReactNode } from "react";

import { PNL_LOSS_HEX, PNL_PROFIT_HEX } from "@/lib/appearance";

export const AXIS = { fontSize: 10, fill: "var(--color-chart-axis)", fontWeight: 500 as const };
export const GRID = "var(--color-chart-grid)";
export const TIME_CHART_H = 200;
export const ROW_CHART_H = 208;
export { PNL_LOSS_HEX, PNL_PROFIT_HEX };

export type MoneyFormat = (n: number, opts?: { signed?: boolean; digits?: number }) => string;

export function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

export function tradeLabel(count: number): string {
  return `${count} ${count === 1 ? "trade" : "trades"}`;
}

function trimNumber(value: string): string {
  return value.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

export function compactMoney(value: number, symbol: string, signed = false): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : value > 0 && signed ? "+" : "";
  if (abs >= 1_000_000) {
    const scaled = abs / 1_000_000;
    const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
    return `${sign}${symbol}${trimNumber(scaled.toFixed(digits))}M`;
  }
  if (abs >= 1_000) {
    const scaled = abs / 1_000;
    const digits = scaled >= 100 ? 0 : 1;
    return `${sign}${symbol}${trimNumber(scaled.toFixed(digits))}K`;
  }
  const digits = Number.isInteger(abs) || abs >= 100 ? 0 : 2;
  return `${sign}${symbol}${abs.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function pnlClass(value: number | null | undefined): string {
  if (value == null || value === 0) return "text-[var(--color-text-secondary)]";
  return value > 0 ? "text-[#1F7A4D]" : "text-[#C23B3B]";
}

export const HOUR_AXIS_TICKS = [0, 4, 8, 12, 16, 20] as const;

export function hourAxisLabel(hour: number): string {
  const end = (hour + 1) % 24;
  if (hour < 11) return `${hour}-${end}am`;
  if (hour === 11) return "11-12pm";
  if (hour === 12) return "12-1pm";
  if (hour < 23) return `${hour - 12}-${end - 12}pm`;
  return "11-12am";
}

export function hourRange(hour: number): string {
  const label = (value: number) => {
    const suffix = value < 12 ? "am" : "pm";
    const hour12 = value % 12 || 12;
    return `${hour12}${suffix}`;
  };
  return `${label(hour)}–${label((hour + 1) % 24)}`;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="px-0.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
      {children}
    </h2>
  );
}

export function AnalyticsEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full min-h-[168px] flex-1 flex-col items-center justify-center px-4 text-center">
      <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">{title}</p>
      <p className="mt-1 max-w-[280px] text-[11px] leading-4 text-[var(--color-text-muted)]">{body}</p>
    </div>
  );
}

export function TipCard({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string; tone?: "pos" | "neg" | "neutral" }[];
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-2 text-[11px] shadow-[var(--shadow-dropdown)]">
      <p className="mb-1 font-semibold text-[var(--color-text-primary)]">{title}</p>
      <dl className="space-y-0.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4">
            <dt className="text-[var(--color-text-muted)]">{row.label}</dt>
            <dd
              className={
                row.tone === "pos"
                  ? "font-semibold tabular-nums text-[#1F7A4D]"
                  : row.tone === "neg"
                    ? "font-semibold tabular-nums text-[#C23B3B]"
                    : "font-medium tabular-nums text-[var(--color-text-primary)]"
              }
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function pnlTone(value: number | null | undefined): "pos" | "neg" | "neutral" {
  if (value == null || value === 0) return "neutral";
  return value > 0 ? "pos" : "neg";
}
