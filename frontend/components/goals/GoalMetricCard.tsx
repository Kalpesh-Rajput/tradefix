"use client";

import clsx from "clsx";
import { Target } from "lucide-react";

import { progressPercent, remainingToGoal, type GoalProgressItem } from "@/lib/goals";

type FormatMoney = (n: number, opts?: { signed?: boolean; digits?: number }) => string;

export function GoalMetricCard({
  item,
  formatMoney,
  compact = false,
}: {
  item: GoalProgressItem;
  formatMoney: FormatMoney;
  compact?: boolean;
}) {
  const pct = progressPercent(item.current, item.target);
  const remaining = remainingToGoal(item.current, item.target);
  const hit = item.current >= item.target && item.target > 0;
  const behind = item.current < 0 || (item.target > 0 && item.current < item.target * 0.35 && item.current < item.target);

  const currentLabel =
    item.unit === "money"
      ? formatMoney(item.current, { signed: true, digits: 0 })
      : `${Math.round(item.current)}`;
  const targetLabel =
    item.unit === "money"
      ? formatMoney(item.target, { signed: false, digits: 0 })
      : `${Math.round(item.target)}`;
  const remainLabel =
    item.unit === "money"
      ? formatMoney(Math.abs(remaining), { signed: false, digits: 0 })
      : `${Math.round(Math.abs(remaining))}`;

  return (
    <div
      className={clsx(
        "rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]",
        compact ? "p-3" : "p-4 sm:p-5"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-primary-very-light)] text-primary">
            <Target className="h-3.5 w-3.5" strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              {item.label}
            </p>
            {!compact && (
              <p className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)]">Earned vs target</p>
            )}
          </div>
        </div>
        <span
          className={clsx(
            "inline-flex h-6 items-center rounded-full px-2 text-[11px] font-semibold tabular-nums",
            hit
              ? "bg-[#E8F6EE] text-[#1F7A4D]"
              : item.current < 0
                ? "bg-[#FDECEE] text-[#C23B3B]"
                : "bg-[#EEE8F8] text-[#5B4696]"
          )}
        >
          {pct.toFixed(0)}%
        </span>
      </div>

      <p
        className={clsx(
          "mt-3 font-semibold tabular-nums leading-none",
          compact ? "text-[20px]" : "text-[26px]",
          item.current > 0 ? "text-positive" : item.current < 0 ? "text-negative" : "text-[var(--color-text-primary)]"
        )}
      >
        {currentLabel}
      </p>
      <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">
        of {targetLabel}
        {item.unit === "trades" ? " trades" : ""}
      </p>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-secondary)]">
        <div
          className={clsx(
            "h-full rounded-full transition-[width] duration-500",
            hit ? "bg-[#1F7A4D]" : item.current < 0 ? "bg-[#C23B3B]" : "bg-primary"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p
        className={clsx(
          "mt-2 text-[11px] font-medium",
          hit ? "text-[#1F7A4D]" : behind && item.current < 0 ? "text-[#C23B3B]" : "text-[var(--color-text-tertiary)]"
        )}
      >
        {hit
          ? "Goal hit"
          : remaining > 0
            ? `${remainLabel}${item.unit === "trades" ? " trades" : ""} remaining`
            : `${remainLabel} over target`}
      </p>
    </div>
  );
}
