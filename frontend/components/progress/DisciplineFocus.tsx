"use client";

import type { DisciplineSnapshot } from "@/lib/progress-tracker/discipline";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[92px]">
      <p className="text-[11px] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-0.5 text-[18px] font-semibold tabular-nums leading-none text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}

export function DisciplineFocusCard({ snapshot }: { snapshot: DisciplineSnapshot }) {
  const { weakest, nextRule, scoredDays, cleanDays, missedDays } = snapshot;
  const headline = weakest
    ? weakest.name
    : scoredDays > 0
      ? "Every active rule held"
      : "Waiting for a scored day";
  const detail = weakest
    ? `Followed on ${Math.round(weakest.follow_rate ?? 0)}% of scored days (${weakest.passed} of ${weakest.applicable}). Tighten this one first.`
    : scoredDays > 0
      ? "Every scored day followed the rules that applied."
      : "Scores appear once a trading day has a rule that applies, including today’s open habits.";

  return (
    <section className="dash-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-[var(--color-text-muted)]">Focus</p>
        <h2 className="mt-1 truncate text-[15px] font-semibold text-[var(--color-text-primary)]">{headline}</h2>
        <p className="mt-1 max-w-xl text-[12px] leading-5 text-[var(--color-text-secondary)]">{detail}</p>
        {nextRule ? (
          <p className="mt-2 text-[12px] text-[var(--color-text-primary)]">
            <span className="text-[var(--color-text-muted)]">Next on this day · </span>
            {nextRule.name}
            {nextRule.detail ? <span className="text-[var(--color-text-muted)]"> · {nextRule.detail}</span> : null}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-5 border-t border-[var(--color-border)] pt-3 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
        <Stat label="Clean days" value={scoredDays ? `${cleanDays}/${scoredDays}` : "—"} />
        <Stat label="Days missed" value={scoredDays ? String(missedDays) : "—"} />
      </div>
    </section>
  );
}
