"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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
  formatPct,
  pnlTone,
  tradeLabel,
  type MoneyFormat,
} from "./shared";

export function WeeklyWinRateChart({
  data,
  formatMoney,
}: {
  data: DashboardPerformance;
  formatMoney: MoneyFormat;
}) {
  const { t } = useLocale();
  const rows = data.weekly_win_rate.map((point) => ({
    ...point,
    rate: point.trades > 0 && point.win_rate != null ? point.win_rate : 0,
    label: point.trades > 0 ? formatPct(point.win_rate) : "—",
  }));

  return (
    <ChartCard title={t("dashboard.weeklyWinRate")} hint={t("dashboard.hint.weeklyWinRate")}>
      <div className="w-full" style={{ height: ROW_CHART_H }} role="img" aria-label={t("dashboard.weeklyWinRate")}>
        {!data.has_trades ? (
          <AnalyticsEmpty title={t("dashboard.empty.title")} body={t("dashboard.empty.weekly")} />
        ) : (
          <ResponsiveContainer width="100%" height={ROW_CHART_H}>
            <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 36, left: 0, bottom: 0 }} barCategoryGap={8}>
              <CartesianGrid stroke={GRID} horizontal={false} strokeDasharray="3 3" />
              <XAxis
                type="number"
                domain={[0, 100]}
                ticks={[0, 20, 40, 60, 80, 100]}
                tick={AXIS}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}%`}
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
                        { label: "Win rate", value: formatPct(row.win_rate) },
                        { label: "Wins", value: String(row.wins) },
                        { label: "Losses", value: String(row.losses) },
                        { label: "Total trades", value: tradeLabel(row.trades) },
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
              <Bar dataKey="rate" radius={[0, 4, 4, 0]} barSize={10} background={{ fill: "var(--color-gauge-track)", radius: 4 }}>
                {rows.map((row) => (
                  <Cell key={row.day} fill={row.trades > 0 ? PNL_PROFIT_HEX : "transparent"} />
                ))}
                <LabelList dataKey="label" position="right" style={{ fontSize: 10, fill: "var(--color-text-secondary)", fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartCard>
  );
}
