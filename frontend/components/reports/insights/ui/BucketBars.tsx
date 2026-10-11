"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { BAR_LOSS_HEX, BAR_PROFIT_HEX, COUNT_SERIES_HEX } from "@/lib/appearance";
import { fmtPct, pnlColor } from "@/lib/reports/advanced/format";
import { formatAxisCurrency } from "@/lib/reports/format";
import type { MoneyFormatter } from "@/lib/reports/types";
import { prefersReducedMotion } from "@/lib/tradefix-score/labels";

import { useDrill } from "../DrillContext";
import { AXIS_TICK, ClickHint, GRID_STROKE, TooltipRow, TooltipShell } from "./chart";
import { Segmented } from "./Segmented";

export type BucketRow = {
  key: string;
  label: string;
  trades: number;
  win_rate: number | null;
  net_pnl: number;
  avg_pnl: number | null;
};

export type BucketMetric = "net" | "avg" | "win" | "count";

const METRIC_OPTIONS: { id: BucketMetric; label: string }[] = [
  { id: "net", label: "Total" },
  { id: "avg", label: "Avg" },
  { id: "win", label: "Win %" },
  { id: "count", label: "Trades" },
];

export function useBucketMetric(initial: BucketMetric = "net") {
  const [metric, setMetric] = useState<BucketMetric>(initial);
  const control = (
    <Segmented<BucketMetric> value={metric} onChange={setMetric} ariaLabel="Chart metric" options={METRIC_OPTIONS} />
  );
  return { metric, control };
}

function valueOf(row: BucketRow, metric: BucketMetric): number | null {
  if (metric === "net") return row.trades ? row.net_pnl : null;
  if (metric === "avg") return row.avg_pnl;
  if (metric === "win") return row.win_rate;
  return row.trades;
}

export function BucketBars({
  rows,
  metric,
  dimension,
  drillTitle,
  formatMoney,
  height,
  layout = "vertical-bars",
}: {
  rows: BucketRow[];
  metric: BucketMetric;
  dimension: string;
  drillTitle: (row: BucketRow) => string;
  formatMoney: MoneyFormatter;
  height: number;
  layout?: "vertical-bars" | "horizontal-bars";
}) {
  const drill = useDrill();
  const data = rows.map((r) => ({ ...r, value: valueOf(r, metric) }));
  const money = metric === "net" || metric === "avg";
  const fill = (v: number | null) => {
    if (metric === "count") return COUNT_SERIES_HEX;
    if (metric === "win") return (v ?? 0) >= 50 ? BAR_PROFIT_HEX : BAR_LOSS_HEX;
    return (v ?? 0) >= 0 ? BAR_PROFIT_HEX : BAR_LOSS_HEX;
  };
  const tick = (n: number) => (money ? formatAxisCurrency(n, formatMoney) : metric === "win" ? `${n}%` : `${n}`);
  const horizontal = layout === "horizontal-bars";

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={horizontal ? { top: 4, right: 12, bottom: 0, left: 4 } : { top: 6, right: 4, bottom: 0, left: -6 }}
          onClick={(e) => {
            const r = e?.activePayload?.[0]?.payload as BucketRow | undefined;
            if (r?.trades) drill({ dimension, key: r.key }, drillTitle(r));
          }}
          className="cursor-pointer"
        >
          <CartesianGrid stroke={GRID_STROKE} vertical={horizontal} horizontal={!horizontal} />
          {horizontal ? (
            <>
              <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={tick} domain={metric === "win" ? [0, 100] : undefined} />
              <YAxis type="category" dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} width={88} />
            </>
          ) : (
            <>
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} minTickGap={0} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={58} tickFormatter={tick} domain={metric === "win" ? [0, 100] : undefined} />
            </>
          )}
          {metric === "win" ? (
            <ReferenceLine {...(horizontal ? { x: 50 } : { y: 50 })} stroke="var(--color-border)" strokeDasharray="3 3" />
          ) : money ? (
            <ReferenceLine {...(horizontal ? { x: 0 } : { y: 0 })} stroke="var(--color-border)" />
          ) : null}
          <Tooltip
            cursor={{ fill: "var(--color-surface-secondary)" }}
            content={({ active, payload }) => {
              const r = payload?.[0]?.payload as BucketRow | undefined;
              if (!active || !r) return null;
              return (
                <TooltipShell title={r.label}>
                  <TooltipRow label="Trades" value={r.trades} />
                  <TooltipRow label="Total P&L" value={formatMoney(r.net_pnl)} color={pnlColor(r.net_pnl)} />
                  <TooltipRow label="Avg per trade" value={r.avg_pnl != null ? formatMoney(r.avg_pnl) : "—"} color={pnlColor(r.avg_pnl)} />
                  <TooltipRow label="Win rate" value={fmtPct(r.win_rate)} />
                  {r.trades ? <ClickHint /> : null}
                </TooltipShell>
              );
            }}
          />
          <Bar dataKey="value" radius={horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0]} maxBarSize={horizontal ? 18 : 42} isAnimationActive={!prefersReducedMotion()}>
            {data.map((r) => (
              <Cell key={r.key} fill={fill(r.value)} fillOpacity={r.trades ? 1 : 0.25} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
