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

import { useAppearance } from "@/components/providers/AppearanceProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { CHART_LINE_HEX, NEGATIVE_HEX, readAccentHex, readPositiveHex } from "@/lib/appearance";

/** Fixed chart body height — avoids Recharts ResponsiveContainer + flex growth loop. */
const CHART_BODY_H = 200;

function ChartCard({
  title,
  children,
  className = "",
  headerRight,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  headerRight?: React.ReactNode;
}) {
  return (
    <div className={`dash-card flex flex-col p-3.5 ${className}`}>
      {(title || headerRight) && (
        <div className="mb-2 flex h-5 shrink-0 items-center justify-between gap-2">
          {title ? (
            <h3 className="text-[12px] font-medium leading-4 text-[var(--color-text-primary)]">
              {title}
            </h3>
          ) : (
            <span />
          )}
          {headerRight}
        </div>
      )}
      {children}
    </div>
  );
}

const tooltipStyle = {
  background: "#fff",
  border: "1px solid #E8E8EC",
  borderRadius: 8,
  fontSize: 11,
  boxShadow: "0 4px 12px rgba(20,20,30,0.08)",
  padding: "6px 10px",
  color: "#1F1F24",
};

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
      headerRight={
        <span className="inline-flex h-[18px] items-center rounded-[9px] bg-[var(--color-warning-badge)] px-2 text-[9px] font-semibold uppercase tracking-wide text-[var(--color-warning-badge-text)]">
          Beta
        </span>
      }
    >
      <div className="w-full shrink-0" style={{ height: CHART_BODY_H }}>
        <ResponsiveContainer width="100%" height={CHART_BODY_H}>
          <RadarChart data={data} cx="50%" cy="52%" outerRadius="68%">
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
      <p className="mt-1 shrink-0 text-center text-[11px] text-[var(--color-text-secondary)]">
        {t("dashboard.zellaScore")}:{" "}
        <span className="font-semibold text-primary">{score.toFixed(1)}</span>
      </p>
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
  const fill = readPositiveHex();
  const line = CHART_LINE_HEX;

  return (
    <ChartCard title={t("dashboard.cumulativePnl")}>
      <div className="w-full shrink-0" style={{ height: CHART_BODY_H }}>
        {series.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height={CHART_BODY_H}>
            <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="cumPnlAccent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={fill} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={fill} stopOpacity={0.02} />
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
                contentStyle={tooltipStyle}
                formatter={(v: number) => [formatMoney(v, { signed: true, digits: 2 }), "P&L"]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={line}
                fill="url(#cumPnlAccent)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3.5, fill: line }}
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
  const positive = readAccentHex();

  return (
    <ChartCard title={t("dashboard.netDailyPnl")}>
      <div className="w-full shrink-0" style={{ height: CHART_BODY_H }}>
        {series.length === 0 ? (
          <EmptyChart />
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
                contentStyle={tooltipStyle}
                formatter={(v: number) => [formatMoney(v, { signed: true, digits: 2 }), "P&L"]}
              />
              <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={22}>
                {series.map((entry, i) => (
                  <Cell key={i} fill={entry.value >= 0 ? positive : NEGATIVE_HEX} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartCard>
  );
}

function EmptyChart() {
  return (
    <div
      className="flex w-full items-center justify-center text-[11px] text-[var(--color-text-muted)]"
      style={{ height: CHART_BODY_H }}
    >
      No trade data in this range
    </div>
  );
}
