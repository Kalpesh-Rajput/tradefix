"use client";

import clsx from "clsx";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

import { Skeleton } from "@/components/ui/Skeleton";
import type { CoachWeekly } from "@/lib/types";

export function WeeklyInsightCard({
  weekly,
  loading,
  compact = false,
}: {
  weekly?: CoachWeekly | null;
  loading?: boolean;
  compact?: boolean;
}) {
  if (loading) {
    return (
      <div
        className={clsx(
          "overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]",
          compact ? "h-12" : "h-[132px]"
        )}
      >
        <Skeleton className="h-full w-full rounded-none bg-[var(--color-primary-very-light)]" />
      </div>
    );
  }

  const insight = weekly?.insight?.trim();
  const execution = [...(weekly?.timeline ?? [])].reverse().find((row) => row.execution != null)?.execution;
  const bestDay = weekly?.edge_finder?.best_day?.bucket;
  const pattern = weekly?.edge_finder?.best_setup?.tag;

  return (
    <section
      className={clsx(
        "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm",
        compact ? "px-4 py-3" : "px-5 py-4"
      )}
    >
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
        <Sparkles className="h-3 w-3" strokeWidth={2} />
        Weekly insight
      </p>
      <p
        className={clsx(
          "mt-2 text-[13px] leading-5 text-[var(--color-text-secondary)]",
          compact && "line-clamp-2"
        )}
      >
        {insight || "Log a few more tagged trades to surface your weekly edge."}
      </p>
      {!compact && (execution != null || bestDay || pattern) ? (
        <dl className="mt-3 flex flex-wrap gap-2">
          {execution != null ? (
            <div className="rounded-lg bg-[var(--color-primary-very-light)] px-2.5 py-1.5">
              <dt className="text-[10px] text-[var(--color-text-tertiary)]">Execution</dt>
              <dd className="text-[13px] font-semibold tabular-nums text-[var(--color-text-primary)]">
                {execution.toFixed(1)}
              </dd>
            </div>
          ) : null}
          {bestDay ? (
            <div className="rounded-lg bg-[var(--color-surface-secondary)] px-2.5 py-1.5 ring-1 ring-[var(--color-border)]">
              <dt className="text-[10px] text-[var(--color-text-tertiary)]">Best day</dt>
              <dd className="text-[13px] font-semibold text-[var(--color-text-primary)]">{bestDay}</dd>
            </div>
          ) : null}
          {pattern ? (
            <div className="rounded-lg bg-[var(--color-surface-secondary)] px-2.5 py-1.5 ring-1 ring-[var(--color-border)]">
              <dt className="text-[10px] text-[var(--color-text-tertiary)]">Emerging pattern</dt>
              <dd className="text-[13px] font-semibold text-[var(--color-text-primary)]">{pattern}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      <Link
        href="/analytics"
        className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-primary transition-colors hover:text-primary-hover"
      >
        View detailed analysis
        <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
      </Link>
    </section>
  );
}
