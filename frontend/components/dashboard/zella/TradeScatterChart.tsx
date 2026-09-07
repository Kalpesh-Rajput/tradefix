"use client";

import {
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CHART_BODY_H, ChartCard, EmptyChart, chartTooltipStyle } from "@/components/dashboard/zella/ChartCard";
import { PNL_LOSS_HEX, PNL_PROFIT_HEX } from "@/lib/appearance";
import { formatClock, formatDuration, type ScatterPoint } from "@/lib/dashboardSeries";

export function TradeScatterChart({
  title,
  hint,
  series,
  formatMoney,
  xMode,
}: {
  title: string;
  hint: string;
  series: ScatterPoint[];
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
  xMode: "clock" | "duration";
}) {
  return (
    <ChartCard title={title} hint={hint}>
      <div className="w-full shrink-0" style={{ height: CHART_BODY_H }}>
        {series.length === 0 ? (
          <EmptyChart height={CHART_BODY_H} />
        ) : (
          <ResponsiveContainer width="100%" height={CHART_BODY_H}>
            <ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECEDEF" vertical={false} />
              <XAxis
                type="number"
                dataKey="x"
                tick={{ fontSize: 9, fill: "#85868E" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => (xMode === "clock" ? formatClock(Number(v)) : formatDuration(Number(v)))}
              />
              <YAxis
                type="number"
                dataKey="y"
                tick={{ fontSize: 9, fill: "#85868E" }}
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={(v) => formatMoney(Number(v), { signed: true, digits: 0 })}
              />
              <ReferenceLine y={0} stroke="#D4D5DB" strokeDasharray="4 4" />
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(v: number, name: string, item) => {
                  if (name === "y") return [formatMoney(v, { signed: true, digits: 2 }), "P&L"];
                  const payload = item?.payload as ScatterPoint | undefined;
                  return [payload?.label ?? String(v), xMode === "clock" ? "Time" : "Duration"];
                }}
                labelFormatter={(_, payload) => (payload?.[0]?.payload as ScatterPoint | undefined)?.symbol ?? ""}
              />
              <Scatter data={series} r={4}>
                {series.map((p, i) => (
                  <Cell key={`${p.symbol}-${i}`} fill={p.y >= 0 ? PNL_PROFIT_HEX : PNL_LOSS_HEX} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartCard>
  );
}
