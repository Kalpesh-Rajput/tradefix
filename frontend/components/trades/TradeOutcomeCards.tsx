"use client";

import clsx from "clsx";
import { useMemo, type ReactNode } from "react";

import { PNL_LOSS_HEX, PNL_PROFIT_HEX } from "@/lib/appearance";
import { computeOutcomeCards } from "@/lib/trades/viewKpis";
import type { Trade } from "@/lib/types";

type Outcome = "" | "profit" | "loss";

function MiniTrend({ values, color, label }: { values: number[]; color: string; label: string }) {
  const source = values.length > 1 ? values : [0, values[0] ?? 0];
  const width = 48;
  const height = 20;
  const pad = 1.5;
  const min = Math.min(...source);
  const max = Math.max(...source);
  const span = max - min;
  const coords = source.map((value, index) => {
    const x = pad + (index / (source.length - 1)) * (width - pad * 2);
    const y = span === 0 ? height / 2 : pad + (1 - (value - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = coords.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const last = coords[coords.length - 1];
  const first = coords[0];
  const area = `${line} L${last[0].toFixed(1)} ${height} L${first[0].toFixed(1)} ${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0" aria-hidden>
      <title>{label}</title>
      <path d={area} fill={color} fillOpacity={0.16} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function MiniRing({ percent, color }: { percent: number; color: string }) {
  const radius = 11;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.max(0, Math.min(100, percent)) / 100) * circumference;

  return (
    <span className="relative block h-8 w-8 shrink-0" aria-hidden>
      <svg viewBox="0 0 32 32" className="h-full w-full">
        <circle cx="16" cy="16" r={radius} fill="none" stroke="var(--color-gauge-track)" strokeWidth="2.5" />
        {filled > 0 ? (
          <circle
            cx="16"
            cy="16"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={percent >= 99.5 ? undefined : `${filled} ${circumference}`}
            transform="rotate(-90 16 16)"
          />
        ) : null}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[8px] font-semibold tabular-nums leading-none text-[var(--color-text-primary)]">
        {Math.round(percent)}%
      </span>
    </span>
  );
}

export function TradeOutcomeCards({
  trades,
  outcome,
  onOutcome,
  formatMoney,
  displayPnl,
}: {
  trades: Trade[];
  outcome: Outcome;
  onOutcome: (next: Outcome) => void;
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
  displayPnl?: (pnl: number | null, fees?: number) => number | null;
}) {
  const stats = useMemo(() => computeOutcomeCards(trades, displayPnl), [trades, displayPnl]);

  function toggle(next: Exclude<Outcome, "">) {
    onOutcome(outcome === next ? "" : next);
  }

  return (
    <>
      <article className="dash-card flex h-[104px] min-w-0 flex-col overflow-hidden rounded-[14px]">
        <OutcomeHalf
          label="Winners"
          pressed={outcome === "profit"}
          tone="profit"
          onClick={() => toggle("profit")}
          value={
            <span className="block text-[18px] font-semibold leading-6 tracking-tight tabular-nums text-[var(--color-text-primary)]">
              {stats.wins}
            </span>
          }
          trend="Cumulative winning trades"
          aside={
            <span className="flex shrink-0 items-center gap-1.5">
              <MiniTrend values={stats.winCount} color={PNL_PROFIT_HEX} label="Cumulative winning trades" />
              <MiniRing percent={stats.winPct} color={PNL_PROFIT_HEX} />
            </span>
          }
        />
        <span className="mx-3.5 h-px shrink-0 bg-[var(--color-border)]" aria-hidden />
        <OutcomeHalf
          label="Losers"
          pressed={outcome === "loss"}
          tone="loss"
          onClick={() => toggle("loss")}
          value={
            <span className="block text-[18px] font-semibold leading-6 tracking-tight tabular-nums text-[var(--color-text-primary)]">
              {stats.losses}
            </span>
          }
          trend="Cumulative losing trades"
          aside={
            <span className="flex shrink-0 items-center gap-1.5">
              <MiniTrend values={stats.lossCount} color={PNL_LOSS_HEX} label="Cumulative losing trades" />
              <MiniRing percent={stats.lossPct} color={PNL_LOSS_HEX} />
            </span>
          }
        />
      </article>

      <article className="dash-card flex h-[104px] min-w-0 flex-col overflow-hidden rounded-[14px]">
        <OutcomeHalf
          label="Avg wins"
          pressed={outcome === "profit"}
          tone="profit"
          onClick={() => toggle("profit")}
          value={
            <span
              className="block truncate text-[18px] font-semibold leading-6 tracking-tight tabular-nums"
              style={{ color: PNL_PROFIT_HEX }}
              title={formatMoney(stats.avgWin, { signed: false, digits: 2 })}
            >
              {formatMoney(stats.avgWin, { signed: false, digits: 2 })}
            </span>
          }
          trend="Cumulative average win"
          aside={<MiniTrend values={stats.avgWinSeries} color={PNL_PROFIT_HEX} label="Cumulative average win" />}
        />
        <span className="mx-3.5 h-px shrink-0 bg-[var(--color-border)]" aria-hidden />
        <OutcomeHalf
          label="Avg loss"
          pressed={outcome === "loss"}
          tone="loss"
          onClick={() => toggle("loss")}
          value={
            <span
              className="block truncate text-[18px] font-semibold leading-6 tracking-tight tabular-nums"
              style={{ color: PNL_LOSS_HEX }}
              title={formatMoney(stats.avgLoss, { signed: false, digits: 2 })}
            >
              {formatMoney(stats.avgLoss, { signed: false, digits: 2 })}
            </span>
          }
          trend="Cumulative average loss"
          aside={<MiniTrend values={stats.avgLossSeries} color={PNL_LOSS_HEX} label="Cumulative average loss" />}
        />
      </article>
    </>
  );
}

function OutcomeHalf({
  label,
  value,
  aside,
  trend,
  pressed,
  tone,
  onClick,
}: {
  label: string;
  value: ReactNode;
  aside?: ReactNode;
  trend?: string;
  pressed: boolean;
  tone: "profit" | "loss";
  onClick: () => void;
}) {
  const action = pressed ? "Show all trades" : tone === "profit" ? "Show only winning trades" : "Show only losing trades";

  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={`${label}. ${trend ? `${trend}. ` : ""}${action}`}
      onClick={onClick}
      className={clsx(
        "flex min-h-0 min-w-0 flex-1 items-center gap-2 px-3.5 text-left transition-colors duration-150",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary",
        pressed
          ? tone === "profit"
            ? "bg-[color-mix(in_srgb,#2F9E6A_12%,transparent)]"
            : "bg-[color-mix(in_srgb,#D64545_10%,transparent)]"
          : "hover:bg-[var(--color-primary-very-light)]"
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-medium leading-4 text-[var(--color-text-label)]">{label}</span>
        {value}
      </span>
      {aside}
    </button>
  );
}
