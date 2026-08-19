"use client";

import clsx from "clsx";
import { Calculator, Info } from "lucide-react";

import { useAppearance } from "@/components/providers/AppearanceProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { NEGATIVE_HEX } from "@/lib/appearance";

const BE_HEX = "#7B8DB8";
const TRACK = "#E7E8EC";

function KpiShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "dash-card flex h-[96px] flex-col justify-start p-3.5",
        className
      )}
    >
      {children}
    </div>
  );
}

function LabelRow({ label }: { label: string }) {
  return (
    <div className="mb-1.5 flex h-4 items-center gap-1 text-[11px] font-medium leading-4 text-[var(--color-text-label)]">
      <span>{label}</span>
      <Info className="h-3 w-3 text-[#777881]" strokeWidth={1.75} />
    </div>
  );
}

function SegmentGauge({
  wins,
  breakeven,
  losses,
  winColor,
}: {
  wins: number;
  breakeven: number;
  losses: number;
  winColor: string;
}) {
  const total = Math.max(wins + breakeven + losses, 1);
  const r = 26;
  const stroke = 5;
  const c = 2 * Math.PI * r;
  const arc = c * 0.66;
  const wLen = (wins / total) * arc;
  const bLen = (breakeven / total) * arc;
  const lLen = (losses / total) * arc;
  const gap = 1.5;

  return (
    <div className="flex flex-col items-center">
      <svg width="68" height="44" viewBox="0 0 68 44" aria-hidden>
        <g transform="translate(34,40)">
          <circle
            r={r}
            fill="none"
            stroke={TRACK}
            strokeWidth={stroke}
            strokeDasharray={`${arc} ${c}`}
            strokeLinecap="round"
            transform="rotate(150)"
          />
          <circle
            r={r}
            fill="none"
            stroke={winColor}
            strokeWidth={stroke}
            strokeDasharray={`${Math.max(wLen - gap, 0)} ${c}`}
            strokeLinecap="round"
            transform="rotate(150)"
          />
          <circle
            r={r}
            fill="none"
            stroke={BE_HEX}
            strokeWidth={stroke}
            strokeDasharray={`${Math.max(bLen - gap, 0)} ${c}`}
            strokeLinecap="round"
            transform={`rotate(${150 + (wins / total) * 240})`}
          />
          <circle
            r={r}
            fill="none"
            stroke={NEGATIVE_HEX}
            strokeWidth={stroke}
            strokeDasharray={`${Math.max(lLen - gap, 0)} ${c}`}
            strokeLinecap="round"
            transform={`rotate(${150 + ((wins + breakeven) / total) * 240})`}
          />
        </g>
      </svg>
      <div className="mt-0.5 flex items-center gap-1.5 text-[8px] font-medium tabular-nums">
        <span style={{ color: winColor }}>{wins}</span>
        <span style={{ color: BE_HEX }}>{breakeven}</span>
        <span style={{ color: NEGATIVE_HEX }}>{losses}</span>
      </div>
    </div>
  );
}

function Donut({ value, color }: { value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (Math.min(value, 5) / 5) * 100));
  const r = 18;
  const c = 2 * Math.PI * r;
  const filled = (pct / 100) * c;

  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0" aria-hidden>
      <circle cx="22" cy="22" r={r} fill="none" stroke={TRACK} strokeWidth="5" />
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeDasharray={`${filled} ${c}`}
        strokeLinecap="round"
        transform="rotate(-90 22 22)"
      />
    </svg>
  );
}

function compactMoney(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}K`;
  return `${sign}$${Math.round(abs)}`;
}

export function MetricCards({
  netPnl,
  winRate,
  profitFactor,
  dayWinPct,
  avgWin,
  avgLoss,
  wins,
  losses,
  breakeven,
  dayWins,
  dayLosses,
  dayBreakeven,
  formatMoney,
}: {
  netPnl: number;
  winRate: number;
  profitFactor: number;
  dayWinPct: number | null;
  avgWin: number;
  avgLoss: number;
  wins: number;
  losses: number;
  breakeven: number;
  dayWins: number;
  dayLosses: number;
  dayBreakeven: number;
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
}) {
  const { t } = useLocale();
  const { accentHex } = useAppearance();
  const avgRatio = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : avgWin > 0 ? avgWin : 0;
  const barTotal = Math.abs(avgWin) + Math.abs(avgLoss) || 1;
  const winBar = (Math.abs(avgWin) / barTotal) * 100;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <KpiShell className="relative justify-start">
        <div className="min-w-0">
          <LabelRow label={t("dashboard.netPnl")} />
          <p
            className={clsx(
              "text-[18px] font-semibold leading-6 tracking-tight",
              netPnl >= 0 ? "text-positive" : "text-negative"
            )}
          >
            {formatMoney(netPnl, { signed: false, digits: 2 })}
          </p>
        </div>
        <span className="absolute bottom-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Calculator className="h-3 w-3" strokeWidth={1.75} />
        </span>
      </KpiShell>

      <KpiShell className="!flex-row !items-start !justify-between !gap-2">
        <div className="min-w-0 pt-0">
          <LabelRow label={t("dashboard.tradeWinPct")} />
          <p className="text-[18px] font-semibold leading-6 tracking-tight text-[var(--color-text-kpi)]">
            {winRate.toFixed(2)}%
          </p>
        </div>
        <div className="shrink-0 self-center">
          <SegmentGauge wins={wins} breakeven={breakeven} losses={losses} winColor={accentHex} />
        </div>
      </KpiShell>

      <KpiShell className="!flex-row !items-start !justify-between !gap-2">
        <div className="min-w-0">
          <LabelRow label={t("dashboard.profitFactor")} />
          <p className="text-[18px] font-semibold leading-6 tracking-tight text-[var(--color-text-kpi)]">
            {profitFactor ? profitFactor.toFixed(2) : "—"}
          </p>
        </div>
        <div className="shrink-0 self-center">
          <Donut value={profitFactor} color={accentHex} />
        </div>
      </KpiShell>

      <KpiShell className="!flex-row !items-start !justify-between !gap-2">
        <div className="min-w-0">
          <LabelRow label={t("dashboard.dayWinPct")} />
          <p className="text-[18px] font-semibold leading-6 tracking-tight text-[var(--color-text-kpi)]">
            {dayWinPct != null ? `${dayWinPct.toFixed(2)}%` : "—"}
          </p>
        </div>
        <div className="shrink-0 self-center">
          <SegmentGauge
            wins={dayWins}
            breakeven={dayBreakeven}
            losses={dayLosses}
            winColor={accentHex}
          />
        </div>
      </KpiShell>

      <KpiShell className="justify-start">
        <div className="min-w-0">
          <LabelRow label={t("dashboard.avgWinLoss")} />
          <p className="mb-2 text-[18px] font-semibold leading-6 tracking-tight text-[var(--color-text-kpi)]">
            {avgRatio ? avgRatio.toFixed(2) : "—"}
          </p>
        </div>
        <div className="mt-auto">
          <div className="mb-1 flex h-1.5 overflow-hidden rounded-[4px] bg-[var(--color-gauge-track)]">
            <div style={{ width: `${winBar}%`, backgroundColor: accentHex }} />
            <div className="flex-1" style={{ backgroundColor: NEGATIVE_HEX }} />
          </div>
          <div className="flex justify-between text-[10px] font-medium tabular-nums">
            <span className="text-positive">{compactMoney(avgWin)}</span>
            <span className="text-negative">{compactMoney(-Math.abs(avgLoss))}</span>
          </div>
        </div>
      </KpiShell>
    </div>
  );
}
