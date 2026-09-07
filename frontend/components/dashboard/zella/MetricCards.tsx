"use client";

import clsx from "clsx";
import { Calculator, Info } from "lucide-react";

import { useLocale } from "@/components/providers/LocaleProvider";
import { PNL_LOSS_HEX, PNL_PROFIT_HEX } from "@/lib/appearance";

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
        "dash-card flex h-[96px] flex-col justify-start overflow-hidden p-3.5",
        className
      )}
    >
      {children}
    </div>
  );
}

function LabelRow({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="mb-1.5 flex h-4 items-center gap-1 text-[11px] font-medium leading-4 text-[var(--color-text-label)]">
      <span className="truncate">{label}</span>
      <Info className="h-3 w-3 shrink-0 text-[#777881]" strokeWidth={1.75} title={hint} />
    </div>
  );
}

function SegmentGauge({
  wins,
  breakeven,
  losses,
}: {
  wins: number;
  breakeven: number;
  losses: number;
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
            stroke={PNL_PROFIT_HEX}
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
            stroke={PNL_LOSS_HEX}
            strokeWidth={stroke}
            strokeDasharray={`${Math.max(lLen - gap, 0)} ${c}`}
            strokeLinecap="round"
            transform={`rotate(${150 + ((wins + breakeven) / total) * 240})`}
          />
        </g>
      </svg>
      <div className="mt-0.5 flex items-center gap-1.5 text-[8px] font-medium tabular-nums">
        <span style={{ color: PNL_PROFIT_HEX }}>{wins}</span>
        <span style={{ color: BE_HEX }}>{breakeven}</span>
        <span style={{ color: PNL_LOSS_HEX }}>{losses}</span>
      </div>
    </div>
  );
}

function Donut({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, (Math.min(value, 5) / 5) * 100));
  const r = 18;
  const c = 2 * Math.PI * r;
  const filled = (pct / 100) * c;
  const color = value >= 1 ? PNL_PROFIT_HEX : PNL_LOSS_HEX;

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

function downsample(values: number[], maxPoints = 40): number[] {
  if (values.length <= maxPoints) return values;
  const step = (values.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, i) => values[Math.round(i * step)] ?? 0);
}

function ExpectancySpark({ values }: { values: number[] }) {
  const w = 72;
  const h = 36;
  const pad = 2;
  const series = downsample(values);
  const last = series[series.length - 1] ?? 0;
  const color = last >= 0 ? PNL_PROFIT_HEX : PNL_LOSS_HEX;

  if (series.length < 2) {
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0" aria-hidden>
        <line x1="4" y1={h / 2} x2={w - 4} y2={h / 2} stroke={TRACK} strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  const min = Math.min(...series, 0);
  const max = Math.max(...series, 0);
  const span = max - min || 1;
  const coords = series.map((v, i) => {
    const x = pad + (i / (series.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / span) * (h - pad * 2);
    return { x, y };
  });
  const line = coords.map((p) => `${p.x},${p.y}`).join(" ");
  const zeroY = pad + (1 - (0 - min) / span) * (h - pad * 2);
  const area = `M${coords[0].x},${zeroY} L${coords.map((p) => `${p.x},${p.y}`).join(" ")} L${coords[coords.length - 1].x},${zeroY} Z`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0" aria-hidden>
      <line x1={pad} y1={zeroY} x2={w - pad} y2={zeroY} stroke={TRACK} strokeWidth="1" />
      <path d={area} fill={color} fillOpacity="0.16" />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r="2.25" fill={color} />
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
  expectancy,
  avgR,
  expectancySeries,
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
  expectancy: number | null;
  avgR: number | null;
  expectancySeries: number[];
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
}) {
  const { t } = useLocale();
  const avgRatio = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : avgWin > 0 ? avgWin : 0;
  const barTotal = Math.abs(avgWin) + Math.abs(avgLoss) || 1;
  const winBar = (Math.abs(avgWin) / barTotal) * 100;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
      <KpiShell className="relative justify-start">
        <div className="min-w-0">
          <LabelRow label={t("dashboard.netPnl")} />
          <p
            className="text-[18px] font-semibold leading-6 tracking-tight"
            style={{ color: netPnl >= 0 ? PNL_PROFIT_HEX : PNL_LOSS_HEX }}
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
          <SegmentGauge wins={wins} breakeven={breakeven} losses={losses} />
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
          <Donut value={profitFactor} />
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
          <SegmentGauge wins={dayWins} breakeven={dayBreakeven} losses={dayLosses} />
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
            <div style={{ width: `${winBar}%`, backgroundColor: PNL_PROFIT_HEX }} />
            <div className="flex-1" style={{ backgroundColor: PNL_LOSS_HEX }} />
          </div>
          <div className="flex justify-between text-[10px] font-medium tabular-nums">
            <span style={{ color: PNL_PROFIT_HEX }}>{compactMoney(avgWin)}</span>
            <span style={{ color: PNL_LOSS_HEX }}>{compactMoney(-Math.abs(avgLoss))}</span>
          </div>
        </div>
      </KpiShell>

      <KpiShell className="!flex-row !items-start !justify-between !gap-2">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <LabelRow label={t("dashboard.expectancy")} hint={t("dashboard.expectancyHint")} />
          <p
            className="text-[18px] font-semibold leading-6 tracking-tight tabular-nums"
            style={{
              color:
                expectancy == null || expectancy === 0
                  ? "var(--color-text-kpi)"
                  : expectancy > 0
                    ? PNL_PROFIT_HEX
                    : PNL_LOSS_HEX,
            }}
          >
            {expectancy == null ? "—" : formatMoney(expectancy, { signed: false, digits: 2 })}
          </p>
          <p className="mt-auto text-[10px] font-medium leading-4 text-[var(--color-text-secondary)]">
            {t("dashboard.expectancyAvgR")}{" "}
            <span className="tabular-nums text-[var(--color-text-kpi)]">
              {avgR != null ? `${avgR.toFixed(2)}R` : "—"}
            </span>
          </p>
        </div>
        <div
          className="shrink-0 self-center"
          title={t("dashboard.expectancyHint")}
        >
          <ExpectancySpark values={expectancySeries} />
        </div>
      </KpiShell>
    </div>
  );
}
