"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartCard } from "@/components/dashboard/zella/ChartCard";
import { useLocale } from "@/components/providers/LocaleProvider";
import type { DashboardPerformance } from "@/lib/types";

import {
  AXIS,
  AnalyticsEmpty,
  GRID,
  PNL_PROFIT_HEX,
  ROW_CHART_H,
  TipCard,
  pnlTone,
  tradeLabel,
  type MoneyFormat,
} from "./shared";

export function WeeklyFrequencyChart({
  data,
  formatMoney,
}: {
  data: DashboardPerformance;
  formatMoney: MoneyFormat;
}) {
  const { t } = useLocale();
  const rows = data.weekly_win_rate;
  const peak = Math.max(0, ...rows.map((row) => row.trades));

  return (
    <ChartCard title={t("dashboard.weeklyFrequency")} hint={t("dashboard.hint.weeklyFrequency")}>
      <div className="w-full" style={{ height: ROW_CHART_H }} role="img" aria-label={t("dashboard.weeklyFrequency")}>
        {peak === 0 ? (
          <AnalyticsEmpty title={t("dashboard.empty.title")} body={t("dashboard.empty.weeklyFreq")} />
        ) : (
          <ResponsiveContainer width="100%" height={ROW_CHART_H}>
            <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }} barCategoryGap={8}>
              <CartesianGrid stroke={GRID} horizontal={false} strokeDasharray="3 3" />
              <XAxis
                type="number"
                allowDecimals={false}
                domain={[0, (max: number) => Math.max(1, Math.ceil(Number(max)))]}
                tick={AXIS}
                tickLine={false}
                axisLine={false}
              />
              <YAxis type="category" dataKey="day" width={36} tick={AXIS} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: "color-mix(in srgb, var(--color-text-muted) 8%, transparent)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0].payload as (typeof rows)[number];
                  if (!row.trades) {
                    return <TipCard title={row.day} rows={[{ label: "Closed trades", value: "None" }]} />;
                  }
                  return (
                    <TipCard
                      title={row.day}
                      rows={[
                        { label: "Total trades", value: tradeLabel(row.trades) },
                        { label: "Wins", value: String(row.wins) },
                        { label: "Losses", value: String(row.losses) },
                        {
                          label: "Net P&L",
                          value: formatMoney(row.pnl ?? 0, { signed: true, digits: 2 }),
                          tone: pnlTone(row.pnl),
                        },
                      ]}
                    />
                  );
                }}
              />
              <Bar dataKey="trades" fill={PNL_PROFIT_HEX} radius={[0, 4, 4, 0]} barSize={10} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartCard>
  );
}
