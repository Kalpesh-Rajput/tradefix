"use client";

import clsx from "clsx";
import { Check, Circle, Minus } from "lucide-react";
import type { ReactNode } from "react";

import type { DailyProgress, RuleResult, RuleStatus } from "@/lib/progress-tracker/types";

function StatusIcon({ status, kind }: { status: RuleStatus; kind: RuleResult["kind"] }) {
  if (status === "passed") {
    return (
      <span
        className={clsx(
          "inline-flex h-[18px] w-[18px] items-center justify-center rounded-full",
          kind === "manual" ? "bg-primary text-on-accent" : "bg-[#2F9E6A] text-white"
        )}
        aria-hidden
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#D64545] text-white" aria-hidden>
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

export function DailyChecklist({
  title,
  day,
  loading,
  items,
  onToggleManual,
  togglingId,
  compact,
  footer,
}: {
  title: string;
  day: DailyProgress | undefined;
  loading?: boolean;
  items?: RuleResult[];
  onToggleManual?: (ruleId: string, completed: boolean) => void;
  togglingId?: string | null;
  compact?: boolean;
  footer?: ReactNode;
}) {
  const rules = items ?? day?.rules ?? [];
  const visible = rules.filter((r) => r.status !== "not_applicable" || r.kind === "manual");

  return (
    <section className={clsx("dash-card flex h-full flex-col p-4", !compact && "min-h-[220px]")}>
      <div className={clsx("mb-3 flex shrink-0 items-center justify-between gap-2", compact ? "h-8" : "h-11")}>
        <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">{title}</h2>
      </div>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded-md bg-[var(--color-primary-very-light)]" />
          ))}
        </div>
      ) : !day?.tracking ? (
        <p className="text-[12px] leading-5 text-[var(--color-text-muted)]">
          No discipline tracking for this date. Open Edit rules to start tracking from today forward.
        </p>
      ) : !day.is_trading_day ? (
        <p className="text-[12px] leading-5 text-[var(--color-text-muted)]">
          This is not one of your configured trading days, so it does not affect your streak.
        </p>
      ) : visible.length === 0 ? (
        <p className="text-[12px] leading-5 text-[var(--color-text-muted)]">
          No active rules for this day. Enable built-in rules or add a manual habit to build a checklist.
        </p>
      ) : (
        <ul className="flex flex-1 flex-col gap-1.5 overflow-y-auto">
          {visible.map((rule) => {
            const canToggle = rule.kind === "manual" && rule.rule_id && onToggleManual && rule.status !== "not_applicable";
            const completed = rule.status === "passed";
            return (
              <li key={rule.rule_key}>
                {canToggle ? (
                  <button
                    type="button"
                    disabled={togglingId === rule.rule_id}
                    onClick={() => onToggleManual(rule.rule_id!, !completed)}
                    className="flex w-full items-center gap-2.5 rounded-md px-1 py-1.5 text-left transition-colors hover:bg-[var(--color-primary-very-light)] disabled:opacity-60"
                    aria-pressed={completed}
                    aria-label={`${rule.name}, ${statusLabel(rule.status)}`}
                  >
                    <StatusIcon status={rule.status} kind={rule.kind} />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--color-text-primary)]">{rule.name}</span>
                    {rule.detail ? (
                      <span className="shrink-0 text-[11px] text-[var(--color-text-muted)]">{rule.detail}</span>
                    ) : null}
                  </button>
                ) : (
                  <div className="flex items-center gap-2.5 rounded-md px-1 py-1.5">
                    <StatusIcon status={rule.status} kind={rule.kind} />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--color-text-primary)]">{rule.name}</span>
                    {rule.detail ? (
                      <span className="max-w-[42%] shrink-0 truncate text-right text-[11px] text-[var(--color-text-muted)]">
                        {rule.detail}
                      </span>
                    ) : null}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {footer}
    </section>
  );
}
