"use client";

import { Info } from "lucide-react";
import { useId, useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

import { Skeleton } from "@/components/ui/Skeleton";
import { PNL_LOSS_HEX, PNL_PROFIT_HEX } from "@/lib/appearance";
import { computeTradeViewKpis } from "@/lib/trades/viewKpis";
import type { Trade } from "@/lib/types";

const TRACK = "#E8E9ED";
const BE_HEX = "#8B95B2";

function compactMoney(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 10000) return `${sign}$${Math.round(abs / 1000)}K`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}K`;
  return `${sign}$${Math.round(abs)}`;
}

export function TradeViewKpis({
  trades,
  loading,
  formatMoney,
  displayPnl,
}: {
  trades: Trade[];
  loading?: boolean;
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
  displayPnl?: (pnl: number | null, fees?: number) => number | null;
}) {
  const stats = useMemo(() => computeTradeViewKpis(trades, displayPnl), [trades, displayPnl]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[104px] rounded-[14px]" />
        ))}
      </div>
    );
  }

  const barTotal = Math.abs(stats.avgWin) + Math.abs(stats.avgLoss) || 1;
  const winBar = (Math.abs(stats.avgWin) / barTotal) * 100;

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <article className="dash-card flex h-[104px] flex-col overflow-hidden rounded-[14px] px-3.5 pb-1.5 pt-2.5">
        <KpiLabel label="Net cumulative P&L" />
        <p
          className="mt-0.5 text-[18px] font-semibold leading-6 tracking-tight tabular-nums"
          style={{ color: stats.netPnl >= 0 ? PNL_PROFIT_HEX : PNL_LOSS_HEX }}
        >
          {formatMoney(stats.netPnl, { signed: false, digits: 2 })}
        </p>
        <div className="mt-auto h-[32px] w-full">
          <PnlSparkline data={stats.series} positive={stats.netPnl >= 0} />
        </div>
      </article>

      <article className="dash-card flex h-[104px] items-center justify-between gap-3 overflow-hidden rounded-[14px] px-3.5 py-2.5">
        <div className="min-w-0">
          <KpiLabel label="Profit factor" hint="Gross profit divided by gross loss" />
          <p className="mt-0.5 text-[18px] font-semibold leading-6 tracking-tight tabular-nums text-[var(--color-text-kpi)]">
            {stats.profitFactor != null ? stats.profitFactor.toFixed(2) : "—"}
          </p>
        </div>
        <SplitDonut wins={stats.grossWins} losses={stats.grossLosses} />
      </article>

      <article className="dash-card flex h-[104px] items-center justify-between gap-3 overflow-hidden rounded-[14px] px-3.5 py-2.5">
        <div className="min-w-0">
          <KpiLabel label="Trade win %" hint="Winning closed trades in the current filters" />
          <p className="mt-0.5 text-[18px] font-semibold leading-6 tracking-tight tabular-nums text-[var(--color-text-kpi)]">
            {stats.winRate != null ? `${stats.winRate.toFixed(2)}%` : "—"}
          </p>
        </div>
        <WinGauge wins={stats.wins} breakeven={stats.breakeven} losses={stats.losses} />
      </article>

      <article className="dash-card flex h-[104px] flex-col overflow-hidden rounded-[14px] px-3.5 pb-2.5 pt-2.5">
        <KpiLabel label="Avg win/loss trade" hint="Average winning trade divided by average losing trade" />
        <p className="mt-0.5 text-[18px] font-semibold leading-6 tracking-tight tabular-nums text-[var(--color-text-kpi)]">
          {stats.avgWinLossRatio != null ? stats.avgWinLossRatio.toFixed(2) : "—"}
        </p>
        <div className="mt-auto">
          <div className="mb-1 flex h-1.5 overflow-hidden rounded-full bg-[#EEEFF3]">
            <div className="h-full" style={{ width: `${winBar}%`, backgroundColor: PNL_PROFIT_HEX }} />
            <div className="h-full flex-1" style={{ backgroundColor: PNL_LOSS_HEX }} />
          </div>
          <div className="flex justify-between text-[11px] font-semibold tabular-nums">
            <span style={{ color: PNL_PROFIT_HEX }}>{compactMoney(stats.avgWin)}</span>
            <span style={{ color: PNL_LOSS_HEX }}>{compactMoney(-Math.abs(stats.avgLoss))}</span>
          </div>
        </div>
      </article>
    </div>
  );
}

function KpiLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex h-4 items-center gap-1 text-[11px] font-medium leading-4 text-[var(--color-text-label)]">
      <span className="truncate">{label}</span>
      <span className="inline-flex" title={hint || label}>
        <Info className="h-3 w-3 shrink-0 text-[#9A9BA3]" strokeWidth={1.75} />
      </span>
    </div>
  );
}

function PnlSparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const gid = useId().replace(/:/g, "");
  const color = positive ? PNL_PROFIT_HEX : PNL_LOSS_HEX;
  const chartData = data.length > 1 ? data.map((v, i) => ({ i, v })) : [
    { i: 0, v: 0 },
    { i: 1, v: data[0] ?? 0 },
  ];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.38} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gid})`}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function SplitDonut({ wins, losses }: { wins: number; losses: number }) {
  const total = wins + losses;
  const r = 24;
  const c = 2 * Math.PI * r;
  const winLen = total > 0 ? (wins / total) * c : 0;
  const lossLen = total > 0 ? c - winLen : 0;

  return (
    <svg width="48" height="48" viewBox="0 0 64 64" className="shrink-0" aria-hidden>
      <circle cx="32" cy="32" r={r} fill="none" stroke={TRACK} strokeWidth="8" />
      {total > 0 ? (
        <>
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke={PNL_LOSS_HEX}
            strokeWidth="8"
            strokeDasharray={`${lossLen} ${c}`}
            strokeDashoffset={-winLen}
            transform="rotate(-90 32 32)"
          />
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke={PNL_PROFIT_HEX}
            strokeWidth="8"
            strokeDasharray={`${winLen} ${c}`}
            strokeLinecap="butt"
            transform="rotate(-90 32 32)"
          />
        </>
      ) : null}
    </svg>
  );
}

function WinGauge({
  wins,
  breakeven,
  losses,
}: {
  wins: number;
  breakeven: number;
  losses: number;
}) {
  const total = Math.max(wins + breakeven + losses, 1);
  const r = 30;
  const stroke = 7;
  const circ = 2 * Math.PI * r;
  const arc = circ * 0.62;
  const wLen = (wins / total) * arc;
  const bLen = (breakeven / total) * arc;
  const lLen = (losses / total) * arc;
  const gap = 2;

  return (
    <div className="flex w-[72px] shrink-0 flex-col items-center">
      <svg width="72" height="42" viewBox="0 0 88 52" aria-hidden>
        <g transform="translate(44,48)">
          <circle
            r={r}
            fill="none"
            stroke={TRACK}
            strokeWidth={stroke}
            strokeDasharray={`${arc} ${circ}`}
            strokeLinecap="round"
            transform="rotate(159)"
          />
          <circle
            r={r}
            fill="none"
            stroke={PNL_PROFIT_HEX}
            strokeWidth={stroke}
            strokeDasharray={`${Math.max(wLen - gap, 0)} ${circ}`}
            strokeLinecap="round"
            transform="rotate(159)"
          />
          <circle
            r={r}
            fill="none"
            stroke={BE_HEX}
            strokeWidth={stroke}
            strokeDasharray={`${Math.max(bLen - gap, 0)} ${circ}`}
            strokeLinecap="round"
            transform={`rotate(${159 + (wins / total) * 222})`}
          />
          <circle
            r={r}
            fill="none"
            stroke={PNL_LOSS_HEX}
            strokeWidth={stroke}
            strokeDasharray={`${Math.max(lLen - gap, 0)} ${circ}`}
            strokeLinecap="round"
            transform={`rotate(${159 + ((wins + breakeven) / total) * 222})`}
          />
        </g>
      </svg>
      <div className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold tabular-nums leading-none">
        <span style={{ color: PNL_PROFIT_HEX }}>{wins}</span>
        <span className="text-[#C5C7CE]">·</span>
        <span style={{ color: BE_HEX }}>{breakeven}</span>
        <span className="text-[#C5C7CE]">·</span>
        <span style={{ color: PNL_LOSS_HEX }}>{losses}</span>
      </div>
    </div>
  );
}
