"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CHART_BODY_COMPACT, ChartCard, EmptyChart, chartTooltipStyle } from "@/components/dashboard/zella/ChartCard";
import { CHART_LINE_HEX } from "@/lib/appearance";
import type { LinePoint } from "@/lib/dashboardSeries";

export function AccountBalanceChart({
  series,
  formatMoney,
}: {
  series: LinePoint[];
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
}) {
  return (
    <ChartCard
      title="Account balance"
      hint="Starting balance plus cumulative closed P&L. The coral line is starting capital (no deposit/withdrawal ledger yet)."
      headerRight={
        <div className="flex items-center gap-2.5 text-[9px] text-[#6B6E78]">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: CHART_LINE_HEX }} />
            Account Balance
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#E8A0A0" }} />
            Deposits / Withdrawals
          </span>
        </div>
      }
    >
      <div className="relative min-h-0 w-full min-w-0 flex-1">
        {series.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <EmptyChart height={CHART_BODY_COMPACT} />
          </div>
        ) : (
          <div className="absolute inset-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                  formatter={(v: number, name: string) => [
                    formatMoney(v, { signed: true, digits: 2 }),
                    name === "baseline" ? "Starting capital" : "Balance",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="baseline"
                  stroke="#E8A0A0"
                  strokeWidth={1.5}
                  dot={false}
                  name="baseline"
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={CHART_LINE_HEX}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3.5, fill: CHART_LINE_HEX }}
                  name="value"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </ChartCard>
  );
}
