"use client";

import clsx from "clsx";

import { InfoTooltip } from "@/components/ui/InfoTooltip";
import type { RuleAnalytics } from "@/lib/progress-tracker/types";

function pct(value: number | null) {
  if (value == null) return "—";
  return `${Math.round(value)}%`;
}

function followRateColor(value: number | null) {
  if (value == null) return "var(--color-text-muted)";
  if (value < 50) return "var(--color-danger)";
  if (value < 80) return "var(--color-text-secondary)";
  return "var(--color-primary)";
}

export function CurrentRulesTable({
  rows,
  loading,
  weakestKey,
  onEdit,
}: {
  rows: RuleAnalytics[];
  loading?: boolean;
  weakestKey?: string | null;
  onEdit: () => void;
}) {
  return (
    <section className="dash-card overflow-hidden">
      <div className="flex h-11 items-center justify-between gap-2 border-b border-[var(--color-border)] px-4">
        <div className="flex min-w-0 items-center gap-1">
          <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Current rules</h2>
          <InfoTooltip
            content="Follow rate is passed rules divided by every day the rule applied in this range, including days still pending."
            label="Current rules"
          />
        </div>
        <button type="button" onClick={onEdit} className="dash-btn-secondary h-8 text-[12px]">
          Edit rules
        </button>
      </div>
      {loading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-[var(--color-primary-very-light)]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="px-4 py-6 text-[12px] text-[var(--color-text-muted)]">
          No rules are enabled. Use Edit rules to turn on trading hours, a stop check, or a daily habit.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[12px]">
            <thead>
              <tr className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                <th className="px-4 py-2 font-medium">Rule</th>
                <th className="px-4 py-2 font-medium">Condition</th>
                <th className="px-4 py-2 font-medium">Streak</th>
                <th className="px-4 py-2 font-medium">Followed</th>
                <th className="px-4 py-2 font-medium">Follow rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const rate = row.follow_rate == null ? 0 : Math.max(0, Math.min(100, row.follow_rate));
                const weak = weakestKey != null && row.rule_key === weakestKey;
                return (
                  <tr
                    key={row.rule_key}
                    className={clsx("border-t border-[var(--color-border)]", weak && "bg-[var(--color-danger-bg)]")}
                  >
                    <td className="px-4 py-2.5 font-medium text-[var(--color-text-primary)]">
                      {row.name}
                      {weak ? (
                        <span className="ml-2 text-[10px] font-medium text-[var(--color-danger-dark)]">Needs work</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-[var(--color-text-secondary)]">{row.condition || "—"}</td>
                    <td className="px-4 py-2.5 tabular-nums text-[var(--color-text-secondary)]">{row.streak}</td>
                    <td className="px-4 py-2.5 tabular-nums text-[var(--color-text-secondary)]">
                      {row.applicable > 0 ? `${row.passed} / ${row.applicable}` : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--color-gauge-track)]">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${row.follow_rate == null ? 0 : rate}%` }} />
                        </div>
                        <span className="tabular-nums font-medium" style={{ color: followRateColor(row.follow_rate) }}>
                          {pct(row.follow_rate)}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
