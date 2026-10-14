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

import { CHART_HOVER_LINE, TipCard } from "@/components/dashboard/analytics/shared";
import { CHART_BODY_COMPACT, ChartCard, EmptyChart } from "@/components/dashboard/zella/ChartCard";
import { useLocale } from "@/components/providers/LocaleProvider";
import { CHART_LINE_HEX } from "@/lib/appearance";
import type { LinePoint } from "@/lib/dashboardSeries";

export function AccountBalanceChart({
  series,
  formatMoney,
}: {
  series: LinePoint[];
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
}) {
  const { t } = useLocale();
  return (
    <ChartCard
      title={t("dashboard.accountBalance")}
      hint={t("dashboard.hint.accountBalance")}
      headerRight={
        <div className="chart-legend max-w-[55%] items-center gap-2 truncate text-[9px] text-[#6B6E78]">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: CHART_LINE_HEX }} />
            Account Balance
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--color-chart-loss)" }} />
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
                    const point = payload[0].payload as { date: string; value: number; baseline?: number };
                    const rows = [
                      {
                        label: "Balance",
                        value: formatMoney(point.value, { signed: true, digits: 2 }),
                      },
                    ];
                    if (point.baseline != null) {
                      rows.push({
                        label: "Starting capital",
                        value: formatMoney(point.baseline, { signed: true, digits: 2 }),
                      });
                    }
                    return <TipCard title={point.date} rows={rows} />;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="baseline"
                  stroke="var(--color-chart-loss)"
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
