"use client";

import type { RuleAnalytics } from "@/lib/progress-tracker/types";

function pct(value: number | null) {
  if (value == null) return "—";
  return `${Math.round(value)}%`;
}

function followRateColor(value: number | null) {
  if (value == null) return "var(--color-text-muted)";
  if (value < 50) return "#D64545";
  if (value < 70) return "var(--color-text-secondary)";
  return "#2F9E6A";
}

export function CurrentRulesTable({
  rows,
  loading,
  onEdit,
}: {
  rows: RuleAnalytics[];
  loading?: boolean;
  onEdit: () => void;
}) {
  return (
    <section className="dash-card overflow-hidden">
      <div className="flex h-11 items-center justify-between gap-2 border-b border-[var(--color-border)] px-4">
        <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Current rules</h2>
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
          No rules are enabled yet. Click Edit rules to configure trading hours, stop-loss checks, or daily habits.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[12px]">
            <thead>
              <tr className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                <th className="px-4 py-2 font-medium">Rule</th>
                <th className="px-4 py-2 font-medium">Condition</th>
                <th className="px-4 py-2 font-medium">Rule streak</th>
                <th className="px-4 py-2 font-medium">Average performance</th>
                <th className="px-4 py-2 font-medium">Follow rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.rule_key} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-2.5 font-medium text-[var(--color-text-primary)]">{row.name}</td>
                  <td className="px-4 py-2.5 tabular-nums text-[var(--color-text-secondary)]">{row.condition || "—"}</td>
                  <td className="px-4 py-2.5 tabular-nums text-[var(--color-text-secondary)]">{row.streak}</td>
                  <td className="px-4 py-2.5 tabular-nums text-[var(--color-text-secondary)]">
                    {row.average_performance || "—"}
                  </td>
                  <td
                    className="px-4 py-2.5 tabular-nums font-medium"
                    style={{ color: followRateColor(row.follow_rate) }}
                  >
                    {pct(row.follow_rate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
