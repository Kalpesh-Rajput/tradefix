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
      <section className="rounded-xl border border-white/[0.06] bg-zinc-950/80 p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <Link href="/settings/goals" className="text-xs text-primary hover:underline">
            Set goals
          </Link>
        </div>
        <p className="mt-2 text-sm text-zinc-500">
          Set weekly, monthly, or yearly P&L targets to track progress here.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-white/[0.06] bg-zinc-950/80 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <Link href="/settings/goals" className="text-xs text-zinc-500 transition hover:text-primary">
          Edit
        </Link>
      </div>
      <div className="space-y-4">
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
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">{item.label}</span>
                <span className="font-mono text-xs text-zinc-300">
                  {currentLabel}
                  <span className="text-zinc-600"> / {targetLabel}</span>
                  <span className="ml-2 text-primary">{pct.toFixed(0)}%</span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
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
