"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { BAR_LOSS_HEX, BAR_PROFIT_HEX } from "@/lib/appearance";
import { pnlColor } from "@/lib/reports/advanced/format";
import { formatAxisCurrency } from "@/lib/reports/format";
import type { AdvancedAnalytics } from "@/lib/reports/advanced/types";
import type { MoneyFormatter } from "@/lib/reports/types";
import { prefersReducedMotion } from "@/lib/tradefix-score/labels";

import { AXIS_TICK, CHART_H_SM, GRID_STROKE, TooltipRow, TooltipShell } from "../../ui/chart";
import { InsightCard, InsufficientState, Stat } from "../../ui/InsightCard";

export function DailyDistributionCard({ data, formatMoney }: { data: AdvancedAnalytics; formatMoney: MoneyFormatter }) {
  const d = data.performance.daily;
  const bins = d.bins.map((b) => ({ ...b, mid: (b.start + b.end) / 2, flat: b.days - b.green - b.red }));
  return (
    <InsightCard
      title="Daily P&L distribution"
      caption={d.status === "ok" ? `${d.sample_size} trading days, grouped by daily result` : "How your trading days are spread"}
      hint="Each bar counts trading days whose total P&L fell in that range. A long left tail means a few bad days drive your losses."
    >
      {d.status !== "ok" ? (
        <InsufficientState reason={d.reason} height={CHART_H_SM + 64} />
      ) : (
        <div className="flex flex-col gap-2">
          <div style={{ height: CHART_H_SM }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bins} margin={{ top: 6, right: 4, bottom: 0, left: -12 }} barCategoryGap={2}>
                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                <XAxis
                  dataKey="mid"
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={24}
                  tickFormatter={(n: number) => formatAxisCurrency(n, formatMoney)}
                />
                <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} width={36} />
                <Tooltip
                  cursor={{ fill: "var(--color-surface-secondary)" }}
                  content={({ active, payload }) => {
                    const b = payload?.[0]?.payload as (typeof bins)[number] | undefined;
                    if (!active || !b) return null;
                    return (
                      <TooltipShell title={`${formatMoney(b.start, { digits: 0 })} to ${formatMoney(b.end, { digits: 0 })}`}>
                        <TooltipRow label="Days" value={b.days} />
                        <TooltipRow label="Green days" value={b.green} color={BAR_PROFIT_HEX} />
                        <TooltipRow label="Red days" value={b.red} color={BAR_LOSS_HEX} />
                        {b.flat ? <TooltipRow label="Flat days" value={b.flat} /> : null}
                      </TooltipShell>
                    );
                  }}
                />
                <Bar dataKey="red" stackId="d" fill={BAR_LOSS_HEX} isAnimationActive={!prefersReducedMotion()} />
                <Bar dataKey="flat" stackId="d" fill="var(--color-text-muted)" isAnimationActive={!prefersReducedMotion()} />
                <Bar dataKey="green" stackId="d" fill={BAR_PROFIT_HEX} radius={[3, 3, 0, 0]} isAnimationActive={!prefersReducedMotion()} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Avg day" value={d.mean != null ? formatMoney(d.mean) : "—"} color={pnlColor(d.mean)} />
            <Stat label="Avg green" value={d.avg_green != null ? formatMoney(d.avg_green) : "—"} color={pnlColor(d.avg_green)} sub={`${d.green_days} days`} />
            <Stat label="Avg red" value={d.avg_red != null ? formatMoney(d.avg_red) : "—"} color={pnlColor(d.avg_red)} sub={`${d.red_days} days`} />
          </div>
        </div>
      )}
    </InsightCard>
  );
}
