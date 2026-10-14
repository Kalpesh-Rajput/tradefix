"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { CHART_HOVER_LINE, TipCard, pnlTone } from "@/components/dashboard/analytics/shared";
import { CHART_BODY_H, ChartCard, EmptyChart } from "@/components/dashboard/zella/ChartCard";
import { useLocale } from "@/components/providers/LocaleProvider";
import { CHART_LINE_HEX, PNL_LOSS_HEX } from "@/lib/appearance";
import type { DrawdownPoint } from "@/lib/dashboardSeries";

export function DrawdownChart({
  series,
  formatMoney,
}: {
  series: DrawdownPoint[];
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
}) {
  const { t } = useLocale();
  return (
    <ChartCard title={t("dashboard.drawdown")} hint={t("dashboard.hint.drawdown")}>
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
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: "var(--color-chart-axis)" }}
                tickLine={false}
                axisLine={false}
                minTickGap={28}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "var(--color-chart-axis)" }}
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={(v) => formatMoney(Number(v), { signed: true, digits: 0 })}
              />
              <Tooltip
                cursor={CHART_HOVER_LINE}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const point = payload[0].payload as { date: string; value: number };
                  return (
                    <TipCard
                      title={point.date}
                      rows={[
                        {
                          label: "Drawdown",
                          value: formatMoney(point.value, { signed: true, digits: 2 }),
                          tone: pnlTone(point.value),
                        },
                      ]}
                    />
                  );
                }}
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
