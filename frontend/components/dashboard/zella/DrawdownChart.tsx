"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { CHART_BODY_H, ChartCard, EmptyChart, chartTooltipStyle } from "@/components/dashboard/zella/ChartCard";
import { CHART_LINE_HEX, PNL_LOSS_HEX } from "@/lib/appearance";
import type { DrawdownPoint } from "@/lib/dashboardSeries";

export function DrawdownChart({
  series,
  formatMoney,
}: {
  series: DrawdownPoint[];
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
}) {
  return (
    <ChartCard title="Drawdown" hint="Distance below the running equity peak for closed trades in this range.">
      <div className="w-full shrink-0" style={{ height: CHART_BODY_H }}>
        {series.length === 0 ? (
          <EmptyChart height={CHART_BODY_H} />
        ) : (
          <ResponsiveContainer width="100%" height={CHART_BODY_H}>
            <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="drawdownFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PNL_LOSS_HEX} stopOpacity={0.02} />
                  <stop offset="55%" stopColor={PNL_LOSS_HEX} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={PNL_LOSS_HEX} stopOpacity={0.42} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECEDEF" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: "#85868E" }}
                tickLine={false}
                axisLine={false}
                minTickGap={28}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "#85868E" }}
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={(v) => formatMoney(Number(v), { signed: true, digits: 0 })}
              />
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(v: number) => [formatMoney(v, { signed: true, digits: 2 }), "Drawdown"]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={CHART_LINE_HEX}
                fill="url(#drawdownFill)"
                strokeWidth={1.75}
                dot={false}
                activeDot={{ r: 3.5, fill: CHART_LINE_HEX }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartCard>
  );
}
