"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { BAR_LOSS_HEX, BAR_PROFIT_HEX } from "@/lib/appearance";
import { fmtR } from "@/lib/reports/advanced/format";
import type { AdvancedAnalytics } from "@/lib/reports/advanced/types";
import { prefersReducedMotion } from "@/lib/tradefix-score/labels";

import { useDrill } from "../../DrillContext";
import { AXIS_TICK, CHART_H_SM, ClickHint, GRID_STROKE, TooltipRow, TooltipShell } from "../../ui/chart";
import { InsightCard, InsufficientState } from "../../ui/InsightCard";

const NEGATIVE = new Set(["<-3", "-3:-2", "-2:-1", "-1:-0.5", "-0.5:0"]);

export function RDistributionCard({ data }: { data: AdvancedAnalytics }) {
  const drill = useDrill();
  const r = data.risk.r;
  const rows = r.distribution.map((d) => ({ ...d, label: d.bucket.replace(":", " to ") }));
  return (
    <InsightCard
      title="R-multiple distribution"
      caption={
        r.status === "ok"
          ? `${r.sample_size} trades with risk set · median ${fmtR(r.median)} · best ${fmtR(r.best)} · worst ${fmtR(r.worst)}`
          : "Trade results in units of the risk you planned"
      }
      hint="Buckets of R = P&L ÷ risk amount. Losses beyond −1R mean a trade lost more than you planned to risk. Click a bar to see the trades."
    >
      {r.status !== "ok" ? (
        <InsufficientState reason={r.reason} height={CHART_H_SM + 20} />
      ) : (
        <div style={{ height: CHART_H_SM + 20 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              margin={{ top: 6, right: 4, bottom: 0, left: -12 }}
              onClick={(e) => {
                const b = e?.activePayload?.[0]?.payload as (typeof rows)[number] | undefined;
                if (b?.count) drill({ dimension: "r_bucket", key: b.bucket }, `Trades between ${b.label}R`);
              }}
              className="cursor-pointer"
            >
              <CartesianGrid stroke={GRID_STROKE} vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" height={40} />
              <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} width={36} />
              <Tooltip
                cursor={{ fill: "var(--color-surface-secondary)" }}
                content={({ active, payload }) => {
                  const b = payload?.[0]?.payload as (typeof rows)[number] | undefined;
                  if (!active || !b) return null;
                  return (
                    <TooltipShell title={`${b.label}R`}>
                      <TooltipRow label="Trades" value={b.count} />
                      <TooltipRow label="Share" value={`${((b.count / r.sample_size) * 100).toFixed(1)}%`} />
                      {b.count ? <ClickHint /> : null}
                    </TooltipShell>
                  );
                }}
              />
              <Bar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={!prefersReducedMotion()}>
                {rows.map((b) => (
                  <Cell key={b.bucket} fill={NEGATIVE.has(b.bucket) ? BAR_LOSS_HEX : BAR_PROFIT_HEX} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </InsightCard>
  );
}
