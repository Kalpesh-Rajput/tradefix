"use client";

import type { ReactNode } from "react";

export const AXIS_TICK = { fontSize: 10, fill: "var(--color-chart-axis)" };
export const GRID_STROKE = "var(--color-chart-grid)";
export const CHART_H = 240;
export const CHART_H_SM = 200;

export function TooltipShell({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-[160px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[11px] shadow-[var(--shadow-dropdown)]">
      {title ? <p className="mb-1 font-semibold text-[var(--color-text-primary)]">{title}</p> : null}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export function TooltipRow({ label, value, color }: { label: string; value: ReactNode; color?: string }) {
  return (
    <p className="flex items-center justify-between gap-4 tabular-nums">
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span className="font-medium" style={{ color: color ?? "var(--color-text-primary)" }}>
        {value}
      </span>
    </p>
  );
}

export function ClickHint() {
  return <p className="pt-1 text-[10px] text-[var(--color-primary)]">Click to see these trades</p>;
}
