"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
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
  TIME_CHART_H,
  TipCard,
  formatPct,
  hourAxisLabel,
  hourRange,
  pnlTone,
  tradeLabel,
  type MoneyFormat,
} from "./shared";

export function HourlyWinRateChart({
  data,
  formatMoney,
}: {
  data: DashboardPerformance;
  formatMoney: MoneyFormat;
}) {
  const { t } = useLocale();
  const rows = data.hourly.map((point) => ({
    ...point,
    rate: point.trades > 0 ? point.win_rate : null,
  }));
  const hasPoints = rows.some((row) => row.rate != null);

  return (
    <ChartCard title={t("dashboard.hourlyWinRate")} hint={t("dashboard.hint.hourlyWinRate")}>
      <div className="w-full" style={{ height: TIME_CHART_H }} role="img" aria-label={t("dashboard.hourlyWinRate")}>
        {!hasPoints ? (
          <AnalyticsEmpty title={t("dashboard.empty.title")} body={t("dashboard.empty.hourlyWin")} />
        ) : (
          <ResponsiveContainer width="100%" height={TIME_CHART_H}>
            <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="hourlyWinFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PNL_PROFIT_HEX} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={PNL_PROFIT_HEX} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID} vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="hour"
                ticks={[0, 5, 10, 15, 20]}
                interval={0}
                tick={AXIS}
                tickLine={false}
                axisLine={false}
                tickFormatter={hourAxisLabel}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tick={AXIS}
                tickLine={false}
                axisLine={false}
                width={36}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0].payload as (typeof rows)[number];
                  if (!row.trades) {
                    return <TipCard title={hourRange(row.hour)} rows={[{ label: "Closed trades", value: "None" }]} />;
                  }
                  return (
                    <TipCard
                      title={hourRange(row.hour)}
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
              <Area
                type="linear"
                dataKey="rate"
                stroke={PNL_PROFIT_HEX}
                strokeWidth={2}
                fill="url(#hourlyWinFill)"
                connectNulls={false}
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  if (payload?.rate == null || cx == null || cy == null) return <g />;
                  return <circle cx={cx} cy={cy} r={2.5} fill={PNL_PROFIT_HEX} />;
                }}
                activeDot={{ r: 4, fill: PNL_PROFIT_HEX }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartCard>
  );
}
