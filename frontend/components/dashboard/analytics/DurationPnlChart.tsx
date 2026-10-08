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

import { ChartCard } from "@/components/dashboard/zella/ChartCard";
import { useLocale } from "@/components/providers/LocaleProvider";
import type { DashboardPerformance, DurationPnlPoint } from "@/lib/types";

import { AXIS, AnalyticsEmpty, BAR_LOSS_HEX, BAR_PROFIT_HEX, GRID, ROW_CHART_H, type MoneyFormat } from "./shared";

const BREAKEVEN = "#B4B7C2";

function formatHoldAxis(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h:${String(mins).padStart(2, "0")}m`;
}

function formatHoldExact(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) return `${hours}h:${String(mins).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m:${String(rem).padStart(2, "0")}s`;
  return `${rem}s`;
}

function outcome(pnl: number): { label: string; fill: string } {
  if (pnl > 0) return { label: "Profit", fill: BAR_PROFIT_HEX };
  if (pnl < 0) return { label: "Loss", fill: BAR_LOSS_HEX };
  return { label: "Break Even", fill: BREAKEVEN };
}

function axisMoney(value: number, formatMoney: MoneyFormat): string {
  if (value < 0) return formatMoney(value, { signed: true, digits: 0 });
  return formatMoney(value, { signed: false, digits: 0 });
}

export function DurationPnlChart({
  data,
  formatMoney,
}: {
  data: DashboardPerformance;
  formatMoney: MoneyFormat;
}) {
  const { t } = useLocale();
  const points = data.duration_pnl ?? [];
  const values = points.map((point) => point.pnl);
  const min = values.length ? Math.min(0, ...values) : 0;
  const max = values.length ? Math.max(0, ...values) : 0;
  const span = Math.max(max - min, 1);
  const yMin = min < 0 ? min - span * 0.1 : 0;
  const yMax = max > 0 ? max + span * 0.1 : 0;
  const domain: [number, number] = yMin === 0 && yMax === 0 ? [-1, 1] : [yMin, yMax];

  return (
    <ChartCard title={t("dashboard.durationPnl")} hint={t("dashboard.hint.durationPnl")}>
      <div className="w-full" style={{ height: ROW_CHART_H }} role="img" aria-label={t("dashboard.durationPnl")}>
        {points.length === 0 ? (
          <AnalyticsEmpty title={t("dashboard.empty.title")} body={t("dashboard.empty.duration")} />
        ) : (
          <ResponsiveContainer width="100%" height={ROW_CHART_H}>
            <ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="seconds"
                domain={[0, (dataMax: number) => Math.max(60, Number(dataMax))]}
                tick={AXIS}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatHoldAxis}
                minTickGap={18}
              />
              <YAxis
                type="number"
                dataKey="pnl"
                domain={domain}
                tick={AXIS}
                tickLine={false}
                axisLine={false}
                width={58}
                tickFormatter={(value) => axisMoney(Number(value), formatMoney)}
              />
              <ReferenceLine y={0} stroke="var(--color-border)" />
              <Tooltip
                cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const point = payload[0].payload as DurationPnlPoint;
                  const kind = outcome(point.pnl);
                  const money =
                    point.pnl === 0
                      ? formatMoney(0, { signed: false, digits: 2 })
                      : formatMoney(point.pnl, { signed: true, digits: 2 });
                  return (
                    <div className="rounded-md bg-[#1B1C21] px-2.5 py-1.5 text-[11px] font-medium text-white shadow-lg">
                      <span className="text-[#C8C8D0]">{kind.label}: </span>
                      {money}
                      <span className="text-[#C8C8D0]"> ({formatHoldExact(point.seconds)})</span>
                    </div>
                  );
                }}
              />
              <Scatter data={points} isAnimationActive={false}>
                {points.map((point, index) => (
                  <Cell key={`${point.seconds}-${index}`} fill={outcome(point.pnl).fill} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartCard>
  );
}
