"use client";

import { useMemo } from "react";
import {
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

import { ChartCard } from "@/components/dashboard/zella/ChartCard";
import { useLocale } from "@/components/providers/LocaleProvider";
import type { DashboardPerformance } from "@/lib/types";

import {
  AXIS,
  AnalyticsEmpty,
  GRID,
  BAR_LOSS_HEX,
  BAR_PROFIT_HEX,
  TIME_CHART_H,
  TipCard,
  formatPct,
  pnlTone,
  tradeLabel,
  type MoneyFormat,
} from "./shared";

export function ProfitByMonthChart({
  data,
  formatMoney,
}: {
  data: DashboardPerformance;
  formatMoney: MoneyFormat;
}) {
  const { t } = useLocale();
  const rows = useMemo(
    () =>
      data.monthly_profit.map((point) => ({
        ...point,
        bar: point.trades > 0 ? point.pnl ?? 0 : null,
        axis: data.monthly_profit.length > 8 ? point.short_label : point.label,
      })),
    [data.monthly_profit]
  );
  const values = rows.flatMap((row) => (row.bar == null ? [] : [row.bar]));
  const hasBars = values.length > 0;
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = Math.max(max - min, 1);
  const yMin = min === 0 ? 0 : min - span * 0.08;
  const yMax = max === 0 ? 0 : max + span * 0.08;

  return (
    <ChartCard title={t("dashboard.profitByMonth")} hint={t("dashboard.hint.profitByMonth")}>
      <div className="w-full" style={{ height: TIME_CHART_H }} role="img" aria-label={t("dashboard.profitByMonth")}>
        {!hasBars ? (
          <AnalyticsEmpty title={t("dashboard.empty.title")} body={t("dashboard.empty.monthly")} />
        ) : (
          <ResponsiveContainer width="100%" height={TIME_CHART_H}>
            <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="axis" tick={AXIS} tickLine={false} axisLine={false} interval={0} minTickGap={8} />
              <YAxis
                domain={[yMin, yMax]}
                allowDataOverflow
                tick={AXIS}
                tickLine={false}
                axisLine={false}
                width={52}
                tickFormatter={(value) => formatMoney(Number(value), { signed: false, digits: 0 })}
              />
              <ReferenceLine y={0} stroke="var(--color-border)" />
              <Tooltip
                cursor={{ fill: "color-mix(in srgb, var(--color-text-muted) 8%, transparent)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0].payload as (typeof rows)[number];
                  if (!row.trades) {
                    return <TipCard title={row.label} rows={[{ label: "Closed trades", value: "None" }]} />;
                  }
                  return (
                    <TipCard
                      title={row.label}
                      rows={[
                        {
                          label: "Net P&L",
                          value: formatMoney(row.pnl ?? 0, { signed: true, digits: 2 }),
                          tone: pnlTone(row.pnl),
                        },
                        { label: "Winning trades", value: String(row.wins) },
                        { label: "Losing trades", value: String(row.losses) },
                        { label: "Total trades", value: tradeLabel(row.trades) },
                        { label: "Win rate", value: formatPct(row.win_rate) },
                      ]}
                    />
                  );
                }}
              />
              <Bar dataKey="bar" radius={[3, 3, 0, 0]} maxBarSize={36}>
                {rows.map((row) => (
                  <Cell key={row.label} fill={(row.bar ?? 0) >= 0 ? BAR_PROFIT_HEX : BAR_LOSS_HEX} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartCard>
  );
}
