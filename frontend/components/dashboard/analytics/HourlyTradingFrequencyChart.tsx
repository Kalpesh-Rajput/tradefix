"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartCard } from "@/components/dashboard/zella/ChartCard";
import { useLocale } from "@/components/providers/LocaleProvider";
import type { DashboardPerformance } from "@/lib/types";

import {
  AXIS,
  AnalyticsEmpty,
  GRID,
  BAR_PROFIT_HEX,
  TIME_CHART_H,
  TipCard,
  HOUR_AXIS_TICKS,
  hourAxisLabel,
  hourRange,
  pnlTone,
  tradeLabel,
  type MoneyFormat,
} from "./shared";

export function HourlyTradingFrequencyChart({
  data,
  formatMoney,
}: {
  data: DashboardPerformance;
  formatMoney: MoneyFormat;
}) {
  const { t } = useLocale();
  const rows = data.hourly;
  const peak = Math.max(0, ...rows.map((row) => row.trades));

  return (
    <ChartCard title={t("dashboard.hourlyFrequency")} hint={t("dashboard.hint.hourlyFrequency")}>
      <div className="w-full" style={{ height: TIME_CHART_H }} role="img" aria-label={t("dashboard.hourlyFrequency")}>
        {peak === 0 ? (
          <AnalyticsEmpty title={t("dashboard.empty.title")} body={t("dashboard.empty.hourlyFreq")} />
        ) : (
          <ResponsiveContainer width="100%" height={TIME_CHART_H}>
            <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
              <CartesianGrid stroke={GRID} vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="hour"
                ticks={[...HOUR_AXIS_TICKS]}
                interval={0}
                tick={AXIS}
                tickLine={false}
                axisLine={false}
                tickFormatter={hourAxisLabel}
              />
              <YAxis
                allowDecimals={false}
                tick={AXIS}
                tickLine={false}
                axisLine={false}
                width={28}
                domain={[0, (max: number) => Math.max(1, max)]}
              />
              <Tooltip
                cursor={{ fill: "color-mix(in srgb, var(--color-text-muted) 8%, transparent)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0].payload as (typeof rows)[number];
                  return (
                    <TipCard
                      title={hourRange(row.hour)}
                      rows={[
                        { label: "Total trades", value: tradeLabel(row.trades) },
                        { label: "Winning trades", value: String(row.wins) },
                        { label: "Losing trades", value: String(row.losses) },
                        {
                          label: "Net P&L",
                          value: row.trades ? formatMoney(row.pnl ?? 0, { signed: true, digits: 2 }) : "—",
                          tone: row.trades ? pnlTone(row.pnl) : "neutral",
                        },
                      ]}
                    />
                  );
                }}
              />
              <Bar dataKey="trades" fill={BAR_PROFIT_HEX} radius={[3, 3, 0, 0]} maxBarSize={14} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartCard>
  );
}
