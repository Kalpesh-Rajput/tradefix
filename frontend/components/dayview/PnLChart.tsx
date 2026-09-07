"use client";

import { useId, useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { chartTooltipStyle } from "@/components/dashboard/zella/ChartCard";
import { PNL_LOSS_HEX, PNL_PROFIT_HEX } from "@/lib/appearance";

const LINE = "#4A4D57";

export function PnLChart({
  values,
  formatMoney,
}: {
  values: number[];
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
}) {
  const gid = useId().replace(/:/g, "");
  const series = useMemo(() => buildSeries(values), [values]);

  return (
    <div className="h-[148px] w-full min-w-0 sm:w-[42%] sm:max-w-[420px] sm:shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={series} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`${gid}-pos`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PNL_PROFIT_HEX} stopOpacity={0.72} />
              <stop offset="100%" stopColor={PNL_PROFIT_HEX} stopOpacity={0.28} />
            </linearGradient>
            <linearGradient id={`${gid}-neg`} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor={PNL_LOSS_HEX} stopOpacity={0.70} />
              <stop offset="100%" stopColor={PNL_LOSS_HEX} stopOpacity={0.26} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#ECEDEF" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="x" hide type="number" domain={["dataMin", "dataMax"]} />
          <YAxis
            tick={{ fontSize: 9, fill: "#85868E", fontWeight: 400 }}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={axisMoney}
          />
          <ReferenceLine y={0} stroke="#C8CAD1" strokeDasharray="4 4" />
          <Tooltip
            contentStyle={chartTooltipStyle}
            formatter={(v) => [formatMoney(Number(v), { signed: true, digits: 2 }), "P&L"]}
            labelFormatter={() => ""}
          />
          <Area
            type="monotone"
            dataKey="pos"
            stroke="none"
            fill={`url(#${gid}-pos)`}
            baseValue={0}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="neg"
            stroke="none"
            fill={`url(#${gid}-neg)`}
            baseValue={0}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={LINE}
            strokeWidth={1.6}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function buildSeries(values: number[]) {
  const pts = values.length >= 2 ? values : [0, values[0] ?? 0];
  const out: { x: number; value: number; pos: number; neg: number }[] = [];
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) {
      const prev = pts[i - 1];
      const curr = pts[i];
      if ((prev > 0 && curr < 0) || (prev < 0 && curr > 0)) {
        const t = prev / (prev - curr);
        out.push({ x: i - 1 + t, value: 0, pos: 0, neg: 0 });
      }
    }
    const value = pts[i];
    out.push({
      x: i,
      value,
      pos: value >= 0 ? value : 0,
      neg: value <= 0 ? value : 0,
    });
  }
  return out;
}

function axisMoney(n: number) {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}K`;
  return `${sign}$${Math.round(abs)}`;
}
