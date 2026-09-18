"use client";

import { useId, useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CHART_LINE_HEX, PNL_LOSS_HEX, PNL_PROFIT_HEX } from "@/lib/appearance";
import { formatAxisValue, formatMetricValue } from "@/lib/reports/format";
import type { MoneyFormatter, ReportMetricDef, ReportSeriesPoint } from "@/lib/reports/types";

const AXIS = { fontSize: 10, fill: "var(--color-chart-axis)" } as const;
const CHART_H = 268;

type ChartRow = {
  x: number;
  label: string;
  tooltipDate: string;
  value: number;
  pos: number | null;
  neg: number | null;
};

function toSignedRows(series: ReportSeriesPoint[]): ChartRow[] {
  const rows: ChartRow[] = [];
  for (let i = 0; i < series.length; i++) {
    const curr = series[i];
    const prev = series[i - 1];
    if (prev && prev.value !== 0 && curr.value !== 0 && Math.sign(prev.value) !== Math.sign(curr.value)) {
      const t = prev.value / (prev.value - curr.value);
      rows.push({
        x: i - 1 + t,
        label: "",
        tooltipDate: "",
        value: 0,
        pos: 0,
        neg: 0,
      });
    }
    rows.push({
      x: i,
      label: curr.label,
      tooltipDate: curr.tooltipDate,
      value: curr.value,
      pos: curr.value >= 0 ? curr.value : null,
      neg: curr.value < 0 ? curr.value : null,
    });
  }
  return rows;
}

function ReportTooltip({
  active,
  payload,
  metric,
  formatMoney,
}: {
  active?: boolean;
  payload?: Array<{ payload?: { tooltipDate?: string; value?: number } }>;
  metric: ReportMetricDef;
  formatMoney: MoneyFormatter;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row?.tooltipDate || row.value == null) return null;
  const color = row.value < 0 && metric.signed ? PNL_LOSS_HEX : PNL_PROFIT_HEX;
  return (
    <div className="min-w-[176px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 shadow-[var(--shadow-dropdown)]">
      <p className="text-[11px] font-medium text-[var(--color-text-primary)]">{row.tooltipDate}</p>
      <p className="mt-1 flex items-center gap-1.5 text-[12px] text-[var(--color-text-secondary)]">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
        <span>
          {metric.label}:{" "}
          <span className="tabular-nums text-[var(--color-text-primary)]">
            {formatMetricValue(row.value, metric.valueType, formatMoney)}
          </span>
        </span>
      </p>
    </div>
  );
}

export function PerformanceChart({
  series,
  metric,
  formatMoney,
  height = CHART_H,
}: {
  series: ReportSeriesPoint[];
  metric: ReportMetricDef;
  formatMoney: MoneyFormatter;
  height?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const posFill = `reportPos_${uid}`;
  const negFill = `reportNeg_${uid}`;
  const areaFill = `reportArea_${uid}`;
  const ticks = useMemo(() => series.map((_, i) => i), [series]);
  const signedRows = useMemo(() => toSignedRows(series), [series]);
  const last = series[series.length - 1]?.value ?? 0;
  const stroke = metric.signed && last < 0 ? PNL_LOSS_HEX : metric.signed ? PNL_PROFIT_HEX : CHART_LINE_HEX;

  if (series.length === 0) {
    return (
      <div className="flex items-center justify-center text-[12px] text-[var(--color-text-muted)]" style={{ height }}>
        No trade data in this range
      </div>
    );
  }

  const yTick = (v: number) => formatAxisValue(Number(v), metric.valueType, formatMoney);
  const xTick = (v: number) => series[v]?.label ?? "";
  const showDots = series.length > 1 && series.length <= 48;
  const posDot = showDots
    ? { r: 2.25, fill: PNL_PROFIT_HEX, strokeWidth: 0 }
    : false;
  const negDot = showDots
    ? { r: 2.25, fill: PNL_LOSS_HEX, strokeWidth: 0 }
    : false;
  const lineDot = showDots ? { r: 2.25, fill: stroke, strokeWidth: 0 } : false;

  if (metric.chartType === "bar") {
    return (
      <div className="w-full min-w-0" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-chart-grid)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} minTickGap={36} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} width={56} tickFormatter={yTick} />
            <ReferenceLine y={0} stroke="var(--color-chart-grid)" />
            <Tooltip
              cursor={{ fill: "rgba(20,20,30,0.04)" }}
              content={<ReportTooltip metric={metric} formatMoney={formatMoney} />}
            />
            <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={20} name={metric.label}>
              {series.map((entry, i) => (
                <Cell
                  key={i}
                  fill={metric.signed && entry.value < 0 ? PNL_LOSS_HEX : PNL_PROFIT_HEX}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (metric.chartType === "signedArea") {
    return (
      <div className="w-full min-w-0" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={signedRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={posFill} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={PNL_PROFIT_HEX} stopOpacity={0.42} />
                <stop offset="55%" stopColor={PNL_PROFIT_HEX} stopOpacity={0.14} />
                <stop offset="100%" stopColor={PNL_PROFIT_HEX} stopOpacity={0} />
              </linearGradient>
              <linearGradient id={negFill} x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor={PNL_LOSS_HEX} stopOpacity={0.36} />
                <stop offset="100%" stopColor={PNL_LOSS_HEX} stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-chart-grid)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="x"
              type="number"
              domain={["dataMin", "dataMax"]}
              ticks={ticks}
              tick={AXIS}
              tickLine={false}
              axisLine={false}
              minTickGap={36}
              tickFormatter={xTick}
            />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} width={72} tickFormatter={yTick} />
            <ReferenceLine y={0} stroke="var(--color-border)" strokeWidth={1} />
            <Tooltip
              cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }}
              content={<ReportTooltip metric={metric} formatMoney={formatMoney} />}
            />
            <Area
              type="monotone"
              dataKey="pos"
              stroke={PNL_PROFIT_HEX}
              fill={`url(#${posFill})`}
              strokeWidth={2}
              dot={posDot}
              activeDot={{ r: 3.5, fill: PNL_PROFIT_HEX, strokeWidth: 0 }}
              isAnimationActive
              animationDuration={280}
              name={metric.label}
            />
            <Area
              type="monotone"
              dataKey="neg"
              stroke={PNL_LOSS_HEX}
              fill={`url(#${negFill})`}
              strokeWidth={2}
              dot={negDot}
              activeDot={{ r: 3.5, fill: PNL_LOSS_HEX, strokeWidth: 0 }}
              isAnimationActive
              animationDuration={280}
              name={metric.label}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={areaFill} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.32} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-chart-grid)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} minTickGap={36} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={72} tickFormatter={yTick} />
          <ReferenceLine y={0} stroke="var(--color-border)" />
          <Tooltip
            cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }}
            content={<ReportTooltip metric={metric} formatMoney={formatMoney} />}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={stroke}
            fill={`url(#${areaFill})`}
            strokeWidth={2}
            dot={lineDot}
            activeDot={{ r: 3.5, fill: stroke, strokeWidth: 0 }}
            isAnimationActive
            animationDuration={280}
            name={metric.label}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
