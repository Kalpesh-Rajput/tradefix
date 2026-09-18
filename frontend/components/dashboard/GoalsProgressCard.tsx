"use client";

import Link from "next/link";

import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { progressPercent, type GoalProgressItem } from "@/lib/goals";

export function GoalsProgressCard({
  items,
  title = "Goal Progress",
  emptyHint = true,
}: {
  items: GoalProgressItem[];
  title?: string;
  emptyHint?: boolean;
}) {
  const { formatMoney } = useAccountPrefs();

  if (!items.length) {
    if (!emptyHint) return null;
    return (
      <section className="dash-card p-3.5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[12px] font-medium text-[var(--color-text-primary)]">{title}</h3>
          <Link href="/settings/goals" className="text-[11px] text-primary hover:underline">
            Set goals
          </Link>
        </div>
        <p className="mt-2 text-[12px] text-[var(--color-text-muted)]">
          Set weekly, monthly, yearly, or daily P&L targets to track progress here.
        </p>
      </section>
    );
  }

  return (
    <section className="dash-card p-3.5">
      <div className="mb-3 flex h-6 items-center justify-between gap-3">
        <h3 className="text-[12px] font-medium text-[var(--color-text-primary)]">{title}</h3>
        <Link
          href="/settings/goals"
          className="text-[11px] text-[var(--color-text-muted)] transition hover:text-primary"
        >
          Edit
        </Link>
      </div>
      <div className="space-y-3">
        {items.map((item) => {
          const pct = progressPercent(item.current, item.target);
          const currentLabel =
            item.unit === "money"
              ? formatMoney(item.current, { signed: true, digits: 0 })
              : `${Math.round(item.current)}`;
          const targetLabel =
            item.unit === "money"
              ? formatMoney(item.target, { signed: false, digits: 0 })
              : `${Math.round(item.target)} trades`;

          return (
            <div key={item.id}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="text-[11px] font-medium text-[var(--color-text-label)]">{item.label}</span>
                <span className="font-mono text-[11px] text-[var(--color-text-secondary)]">
                  {currentLabel}
                  <span className="text-[var(--color-text-muted)]"> / {targetLabel}</span>
                  <span className="ml-2 text-primary">{pct.toFixed(0)}%</span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-gauge-track)]">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
