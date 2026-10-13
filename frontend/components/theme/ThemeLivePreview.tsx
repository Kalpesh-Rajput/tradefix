"use client";

import type { CSSProperties } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cssForCustom } from "@/lib/custom-theme";
import type { ColorMap } from "@/lib/custom-theme";
import type { ThemePresetId } from "@/lib/theme-registry";

export function ThemeLivePreview({ baseThemeId, colors }: { baseThemeId: ThemePresetId; colors: ColorMap }) {
  const vars = cssForCustom(baseThemeId, colors);
  const style = vars as CSSProperties;
  const gradient = `linear-gradient(135deg, ${colors.gradientStart} 0%, ${colors.gradientMiddle} 55%, ${colors.gradientEnd} 100%)`;

  return (
    <div
      className="overflow-hidden rounded-xl border border-border text-left shadow-sm"
      style={style}
      data-custom-theme="1"
      aria-hidden
    >
      <div className="flex min-h-[28rem] bg-background text-foreground">
        <aside className="flex w-[7.5rem] shrink-0 flex-col gap-1 border-r border-sidebar-border bg-sidebar p-2 text-sidebar-foreground">
          <p className="px-1 text-[11px] font-semibold">TradeFix</p>
          <span className="rounded-md bg-sidebar-active px-2 py-1 text-[11px] font-medium" style={{ color: "var(--color-sidebar-active-text, inherit)" }}>
            Dashboard
          </span>
          <span className="rounded-md px-2 py-1 text-[11px] text-sidebar-muted">Trades</span>
          <span className="mt-auto h-6 rounded-md" style={{ background: gradient }} />
        </aside>
        <div className="min-w-0 flex-1">
          <header
            className="flex h-11 items-center justify-between border-b px-3"
            style={{
              background: "var(--color-header, var(--color-surface))",
              color: "var(--color-header-foreground, var(--color-text-primary))",
              borderColor: "var(--color-header-border, var(--color-border))",
            }}
          >
            <p className="text-sm font-semibold">Today</p>
            <Button type="button" size="sm" tabIndex={-1}>
              Add trade
            </Button>
          </header>
          <div className="grid gap-2 p-3">
            <div className="grid grid-cols-3 gap-2">
              <Metric label="Net P&L" value="+$420" color="var(--color-pnl-positive, var(--color-success-text))" />
              <Metric label="Loss" value="-$80" color="var(--color-pnl-negative, var(--color-danger-text))" />
              <Metric label="Win rate" value="62%" color="var(--color-win-rate, var(--color-chart-profit))" />
            </div>
            <div className="dash-card p-3" style={{ borderColor: "var(--color-card-border, var(--color-border))" }}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Equity</p>
              <PreviewChart />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="secondary" tabIndex={-1}>
                Secondary
              </Button>
              <Button type="button" size="sm" variant="ghost" tabIndex={-1}>
                Ghost
              </Button>
              <Button type="button" size="sm" variant="danger" tabIndex={-1}>
                Delete
              </Button>
              <Badge tone="positive">Win</Badge>
              <Badge tone="negative">Loss</Badge>
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{ background: "var(--color-warning-bg)", color: "var(--color-warning-text)" }}
              >
                Warning
              </span>
            </div>
            <label className="block text-[11px] font-medium" style={{ color: "var(--color-text-label)" }}>
              Symbol
              <input
                readOnly
                value="AAPL"
                className="mt-1 h-8 w-full rounded-md border px-2 text-sm"
                style={{
                  background: "var(--color-input-bg)",
                  color: "var(--color-input-text, var(--color-text-primary))",
                  borderColor: "var(--color-input-border)",
                }}
              />
            </label>
            <table className="w-full text-left text-[11px]">
              <thead style={{ background: "var(--color-table-header)", color: "var(--color-table-header-foreground, var(--color-text-secondary))" }}>
                <tr>
                  <th className="px-2 py-1 font-medium">Symbol</th>
                  <th className="px-2 py-1 font-medium">P&L</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ background: "var(--color-table-hover)" }}>
                  <td className="px-2 py-1">ES</td>
                  <td className="px-2 py-1" style={{ color: "var(--color-pnl-positive, var(--color-success-text))" }}>
                    +$120
                  </td>
                </tr>
                <tr style={{ background: "var(--color-table-selected)" }}>
                  <td className="px-2 py-1">NQ</td>
                  <td className="px-2 py-1" style={{ color: "var(--color-pnl-negative, var(--color-danger-text))" }}>
                    -$40
                  </td>
                </tr>
              </tbody>
            </table>
            <div
              className="w-fit rounded-md border px-2 py-1 text-[11px]"
              style={{
                background: "var(--color-tooltip-bg)",
                color: "var(--color-tooltip-text)",
                borderColor: "var(--color-tooltip-border)",
              }}
            >
              Tooltip · hover detail
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function PreviewChart() {
  return (
    <svg viewBox="0 0 240 72" className="mt-2 h-16 w-full" role="img">
      <title>Sample equity and profit bars</title>
      <rect x="0" y="0" width="240" height="72" fill="var(--color-chart-bg, transparent)" />
      {[18, 36, 54].map((y) => (
        <line key={y} x1="0" x2="240" y1={y} y2={y} stroke="var(--color-chart-grid)" strokeWidth="1" />
      ))}
      <polyline
        fill="none"
        stroke="var(--color-chart-line)"
        strokeWidth="2"
        points="8,58 48,46 88,50 128,28 168,34 208,16"
      />
      <polyline
        fill="none"
        stroke="var(--color-chart-drawdown)"
        strokeWidth="1.5"
        strokeDasharray="3 2"
        points="8,62 48,60 88,64 128,52 168,58 208,48"
      />
      <rect x="214" y="20" width="8" height="36" rx="1" fill="var(--color-chart-profit)" />
      <rect x="226" y="40" width="8" height="16" rx="1" fill="var(--color-chart-loss)" />
      <line x1="128" y1="8" x2="128" y2="68" stroke="var(--color-chart-crosshair, var(--color-chart-axis))" strokeDasharray="2 2" />
    </svg>
  );
}
