"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CHART_BODY_H, ChartCard, EmptyChart, chartTooltipStyle } from "@/components/dashboard/zella/ChartCard";
import { useAppearance } from "@/components/providers/AppearanceProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { PNL_LOSS_HEX, PNL_PROFIT_HEX } from "@/lib/appearance";

export function ZellaScoreCard({
  winRate,
  profitFactor,
  avgWinLoss,
}: {
  winRate: number;
  profitFactor: number;
  avgWinLoss: number;
}) {
  const { t } = useLocale();
  const { accentHex } = useAppearance();

  const winScore = Math.min(100, winRate);
  const pfScore = Math.min(100, (profitFactor / 3) * 100);
  const ratioScore = Math.min(100, (avgWinLoss / 3) * 100);
  const score = Number(((winScore + pfScore + ratioScore) / 3).toFixed(1));

  const data = [
    { metric: "Win %", value: winScore, full: 100 },
    { metric: "Profit factor", value: pfScore, full: 100 },
    { metric: "Avg win/loss", value: ratioScore, full: 100 },
  ];

  return (
    <ChartCard
      title={t("dashboard.zellaScore")}
      headerRight={
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[13px] font-semibold tabular-nums text-primary">{score.toFixed(1)}</span>
          <span className="inline-flex h-[18px] items-center rounded-[9px] bg-[var(--color-warning-badge)] px-2 text-[9px] font-semibold uppercase tracking-wide text-[var(--color-warning-badge-text)]">
            Beta
          </span>
        </div>
      }
    >
      <div className="w-full shrink-0" style={{ height: CHART_BODY_H }}>
        <ResponsiveContainer width="100%" height={CHART_BODY_H}>
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="#E5E4EC" strokeOpacity={0.9} />
            <PolarAngleAxis
              dataKey="metric"
              tick={{ fill: "#555663", fontSize: 10, fontWeight: 400 }}
            />
            <Radar dataKey="full" stroke="transparent" fill={accentHex} fillOpacity={0.05} />
            <Radar
              dataKey="value"
              stroke={accentHex}
              fill={accentHex}
              fillOpacity={0.22}
              strokeWidth={1.75}
              dot={{ r: 2.5, fill: accentHex, strokeWidth: 0 }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function CumulativePnlChart({
  series,
  formatMoney,
}: {
  series: { date: string; value: number }[];
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
}) {
  const { t } = useLocale();
  const last = series[series.length - 1]?.value ?? 0;
  const inProfit = last >= 0;
  const tone = inProfit ? PNL_PROFIT_HEX : PNL_LOSS_HEX;
  const values = series.map((s) => s.value);
  const max = Math.max(0, ...values, 0);
  const min = Math.min(0, ...values, 0);
  const span = max - min;
  const zeroAt = span > 0 ? max / span : inProfit ? 1 : 0;

  return (
    <ChartCard title={t("dashboard.cumulativePnl")}>
      <div className="w-full shrink-0" style={{ height: CHART_BODY_H }}>
        {series.length === 0 ? (
          <EmptyChart height={CHART_BODY_H} />
        ) : (
          <ResponsiveContainer width="100%" height={CHART_BODY_H}>
            <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="cumPnlFill" x1="0" y1="0" x2="0" y2="1">
                  {min < 0 && max > 0 ? (
                    <>
                      <stop offset={0} stopColor={PNL_PROFIT_HEX} stopOpacity={0.28} />
                      <stop offset={zeroAt} stopColor={PNL_PROFIT_HEX} stopOpacity={0.04} />
                      <stop offset={zeroAt} stopColor={PNL_LOSS_HEX} stopOpacity={0.04} />
                      <stop offset={1} stopColor={PNL_LOSS_HEX} stopOpacity={0.26} />
                    </>
                  ) : (
                    <>
                      <stop offset="0%" stopColor={tone} stopOpacity={0.26} />
                      <stop offset="100%" stopColor={tone} stopOpacity={0.03} />
                    </>
                  )}
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECEDEF" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: "#85868E", fontWeight: 400 }}
                tickLine={false}
                axisLine={false}
                minTickGap={28}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "#85868E", fontWeight: 400 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatMoney(Number(v), { signed: false, digits: 0 })}
                width={48}
              />
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(v: number) => [formatMoney(v, { signed: true, digits: 2 }), "P&L"]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={tone}
                fill="url(#cumPnlFill)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3.5, fill: tone }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartCard>
  );
}

export function DailyPnlChart({
  series,
  formatMoney,
}: {
  series: { date: string; value: number }[];
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
}) {
  const { t } = useLocale();

  return (
    <ChartCard title={t("dashboard.netDailyPnl")}>
      <div className="w-full shrink-0" style={{ height: CHART_BODY_H }}>
        {series.length === 0 ? (
          <EmptyChart height={CHART_BODY_H} />
        ) : (
          <ResponsiveContainer width="100%" height={CHART_BODY_H}>
            <BarChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECEDEF" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: "#85868E", fontWeight: 400 }}
                tickLine={false}
                axisLine={false}
                minTickGap={28}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "#85868E", fontWeight: 400 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatMoney(Number(v), { signed: false, digits: 0 })}
                width={48}
              />
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(v: number) => [formatMoney(v, { signed: true, digits: 2 }), "P&L"]}
              />
              <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={22}>
                {series.map((entry, i) => (
                  <Cell key={i} fill={entry.value >= 0 ? PNL_PROFIT_HEX : PNL_LOSS_HEX} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartCard>
  );
}
