"use client";

import clsx from "clsx";
import { Check, Circle, Minus } from "lucide-react";
import type { ReactNode } from "react";

import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { isoDay } from "@/lib/progress-tracker/discipline";
import type { DailyProgress, RuleResult, RuleStatus } from "@/lib/progress-tracker/types";

const STATUS_RANK: Record<RuleStatus, number> = {
  pending: 0,
  failed: 1,
  passed: 2,
  not_applicable: 3,
};

function StatusIcon({ status }: { status: RuleStatus }) {
  if (status === "passed") {
    return (
      <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-primary text-on-accent" aria-hidden>
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[var(--color-danger)] text-white" aria-hidden>
        <Minus className="h-3 w-3" strokeWidth={3} />
      </span>
    );
  }
  if (status === "not_applicable") {
    return (
      <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[var(--color-border)] text-[var(--color-text-muted)]" aria-hidden>
        <Circle className="h-2.5 w-2.5" strokeWidth={2} />
      </span>
    );
  }
  return (
    <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]" aria-hidden>
      <Circle className="h-2 w-2 text-[var(--color-text-muted)]" strokeWidth={2} />
    </span>
  );
}

function statusLabel(status: RuleStatus) {
  if (status === "passed") return "Passed";
  if (status === "failed") return "Failed";
  if (status === "not_applicable") return "Not applicable";
  return "Pending";
}

function detailClass(status: RuleStatus) {
  if (status === "failed") return "text-[var(--color-danger-dark)]";
  if (status === "pending") return "text-[var(--color-text-secondary)]";
  return "text-[var(--color-text-muted)]";
}

export function DailyChecklist({
  title,
  day,
  today,
  loading,
  items,
  onToggleManual,
  onStartDay,
  starting,
  togglingId,
  compact,
  footer,
}: {
  title: string;
  day: DailyProgress | undefined;
  today?: string;
  loading?: boolean;
  items?: RuleResult[];
  onToggleManual?: (ruleId: string, completed: boolean) => void;
  onStartDay?: () => void;
  starting?: boolean;
  togglingId?: string | null;
  compact?: boolean;
  footer?: ReactNode;
}) {
  const rules = items ?? day?.rules ?? [];
  const ranked = [...rules].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);
  const visible = ranked.filter((rule) => rule.status !== "not_applicable" || rule.kind === "manual");
  const skipped = ranked.filter((rule) => rule.status === "not_applicable" && rule.kind === "builtin");
  const future = !!day && !!today && isoDay(day.date) > isoDay(today);
  const scoreLabel =
    day && day.is_trading_day && day.score != null ? `${Math.round(day.score)}%` : null;

  return (
    <section className={clsx("dash-card flex h-full flex-col p-4", !compact && "min-h-[220px]")}>
      <div className={clsx("mb-3 flex shrink-0 items-center justify-between gap-2", compact ? "h-8" : "h-11")}>
        <div className="flex min-w-0 items-center gap-1">
          <h2 className="truncate text-[13px] font-semibold text-[var(--color-text-primary)]">{title}</h2>
          <InfoTooltip
            content="Open habits come first, then misses, then rules you already followed. Manual habits can be checked here."
            label={title}
          />
        </div>
        {scoreLabel ? (
          <span className="shrink-0 text-[13px] font-semibold tabular-nums text-primary">{scoreLabel}</span>
        ) : null}
      </div>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded-md bg-[var(--color-primary-very-light)]" />
          ))}
        </div>
      ) : !day?.tracking ? (
        <p className="text-[12px] leading-5 text-[var(--color-text-muted)]">
          Tracking has not started for this date. Rules apply from the day you save them.
        </p>
      ) : future ? (
        <p className="text-[12px] leading-5 text-[var(--color-text-muted)]">
          This day has not arrived. Rules are scored when it does.
        </p>
      ) : !day.is_trading_day ? (
        <p className="text-[12px] leading-5 text-[var(--color-text-muted)]">
          This is outside your trading days, so it stays out of the streak and the score.
        </p>
      ) : rules.length === 0 ? (
        <p className="text-[12px] leading-5 text-[var(--color-text-muted)]">
          No active rules for this day. Turn on a built-in rule or add a habit.
        </p>
      ) : visible.length === 0 ? (
        <div>
          <p className="text-[12px] leading-5 text-[var(--color-text-muted)]">
            No trades on this day, so the trade rules do not apply.
          </p>
          {skipped.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {skipped.map((rule) => (
                <li key={rule.rule_key} className="text-[12px] text-[var(--color-text-secondary)]">
                  {rule.name}
                  {rule.detail ? <span className="text-[var(--color-text-muted)]"> · {rule.detail}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <ul className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {visible.map((rule) => {
            const canStart = rule.rule_key === "start_day" && rule.status === "pending" && !!onStartDay;
            const canToggle = rule.kind === "manual" && rule.rule_id && onToggleManual && rule.status !== "not_applicable";
            const completed = rule.status === "passed";
            const row = (
              <>
                <StatusIcon status={rule.status} />
                <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--color-text-primary)]">{rule.name}</span>
                {canStart ? (
                  <span className="shrink-0 text-[11px] font-medium text-primary">Start</span>
                ) : rule.detail ? (
                  <span className={clsx("max-w-[46%] shrink-0 truncate text-right text-[11px]", detailClass(rule.status))}>
                    {rule.detail}
                  </span>
                ) : null}
              </>
            );
            return (
              <li key={rule.rule_key}>
                {canStart ? (
                  <button
                    type="button"
                    disabled={starting}
                    onClick={() => onStartDay?.()}
                    className="flex w-full items-center gap-2.5 rounded-md px-1 py-1.5 text-left transition-colors hover:bg-[var(--color-primary-very-light)] disabled:opacity-60"
                    aria-label={`${rule.name}, start today`}
                  >
                    {row}
                  </button>
                ) : canToggle ? (
                  <button
                    type="button"
                    disabled={togglingId === rule.rule_id}
                    onClick={() => onToggleManual(rule.rule_id!, !completed)}
                    className="flex w-full items-center gap-2.5 rounded-md px-1 py-1.5 text-left transition-colors hover:bg-[var(--color-primary-very-light)] disabled:opacity-60"
                    aria-pressed={completed}
                    aria-label={`${rule.name}, ${statusLabel(rule.status)}`}
                  >
                    {row}
                  </button>
                ) : (
                  <div className="flex items-center gap-2.5 rounded-md px-1 py-1.5">{row}</div>
                )}
              </li>
            );
          })}
          {skipped.length > 0 ? (
            <li className="mt-2 border-t border-[var(--color-border)] pt-2">
              <p className="px-1 text-[10px] font-medium text-[var(--color-text-muted)]">Does not apply</p>
              <ul className="mt-1 space-y-1">
                {skipped.map((rule) => (
                  <li key={rule.rule_key} className="flex items-center gap-2 px-1 text-[11px] text-[var(--color-text-muted)]">
                    <StatusIcon status={rule.status} />
                    <span className="min-w-0 flex-1 truncate">{rule.name}</span>
                    {rule.detail ? <span className="shrink-0 truncate">{rule.detail}</span> : null}
                  </li>
                ))}
              </ul>
            </li>
          ) : null}
        </ul>
      )}
      {footer}
    </section>
  );
}
