"use client";

import clsx from "clsx";
import { Flame } from "lucide-react";

function ScoreRing({ value }: { value: number | null }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  const r = 28;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <svg viewBox="0 0 72 72" className="h-[72px] w-[72px]" aria-hidden>
      <circle cx="36" cy="36" r={r} fill="none" stroke="var(--color-gauge-track)" strokeWidth="8" />
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 36 36)"
      />
      <text
        x="36"
        y="40"
        textAnchor="middle"
        className="fill-[var(--color-text-primary)]"
        style={{ fontSize: "14px", fontWeight: 650 }}
      >
        {value == null ? "—" : `${Math.round(value)}%`}
      </text>
    </svg>
  );
}

export function ProgressMetrics({
  streak,
  periodScore,
  todayPassed,
  todayTotal,
  loading,
}: {
  streak: number;
  periodScore: number | null;
  todayPassed: number;
  todayTotal: number;
  loading?: boolean;
}) {
  const progressPct = todayTotal > 0 ? Math.round((todayPassed / todayTotal) * 100) : 0;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <section className="dash-card flex min-h-[148px] flex-col p-4">
        <p className="text-[11px] font-medium text-[var(--color-text-muted)]">Current streak</p>
        {loading ? (
          <div className="mt-4 h-10 w-24 animate-pulse rounded bg-[var(--color-primary-very-light)]" />
        ) : (
          <div className="mt-3 flex items-end gap-2">
            <p className="text-[32px] font-semibold leading-none tracking-tight text-[var(--color-text-primary)]">
              {streak}
            </p>
            <p className="pb-1 text-[13px] text-[var(--color-text-secondary)]">{streak === 1 ? "day" : "days"}</p>
            <Flame className="mb-0.5 h-5 w-5 text-[#F59E0B]" strokeWidth={2} aria-hidden />
          </div>
        )}
        <p className="mt-auto pt-3 text-[11px] leading-4 text-[var(--color-text-muted)]">
          Consecutive trading days you started. Weekends you skipped in rules do not break it.
        </p>
      </section>

      <section className="dash-card flex min-h-[148px] flex-col p-4">
        <p className="text-[11px] font-medium text-[var(--color-text-muted)]">Current period score</p>
        <div className="mt-2 flex flex-1 items-center gap-3">
          {loading ? (
            <div className="h-[72px] w-[72px] animate-pulse rounded-full bg-[var(--color-primary-very-light)]" />
          ) : (
            <ScoreRing value={periodScore} />
          )}
          <p className="text-[11px] leading-4 text-[var(--color-text-muted)]">
            Average rule-follow score for the selected date range.
          </p>
        </div>
      </section>

      <section className="dash-card flex min-h-[148px] flex-col p-4">
        <p className="text-[11px] font-medium text-[var(--color-text-muted)]">Today&apos;s progress</p>
        {loading ? (
          <div className="mt-4 h-8 w-16 animate-pulse rounded bg-[var(--color-primary-very-light)]" />
        ) : (
          <p className="mt-3 text-[32px] font-semibold leading-none tracking-tight text-[var(--color-text-primary)]">
            {todayPassed}
            <span className="text-[18px] font-medium text-[var(--color-text-muted)]"> / {todayTotal}</span>
          </p>
        )}
        <div className="mt-auto pt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-gauge-track)]">
            <div
              className={clsx("h-full rounded-full bg-primary transition-[width] duration-300")}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
