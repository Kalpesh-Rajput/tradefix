"use client";

import { Check, Loader2, Pencil, Share2 } from "lucide-react";
import { useEffect, useState } from "react";

import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/ui/Toast";

export type CalendarPeriodStats = {
  netPnl: number;
  winRate: number;
  bestDay: number;
  trades: number;
  tradingDays: number;
  journaled: number;
};

export function CalendarSidebar({
  periodLabel,
  goalCurrent,
  stats,
}: {
  periodLabel: string;
  goalCurrent: number;
  stats: CalendarPeriodStats;
}) {
  const { user, updateProfile } = useAuth();
  const { formatMoney, currencySymbol } = useAccountPrefs();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [goalDraft, setGoalDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const monthlyGoal = user?.monthly_goal != null ? Number(user.monthly_goal) : null;

  useEffect(() => {
    if (!editing) {
      setGoalDraft(monthlyGoal != null ? String(monthlyGoal) : "");
    }
  }, [monthlyGoal, editing]);

  async function saveGoal() {
    const trimmed = goalDraft.trim();
    const next = trimmed === "" ? null : Number(trimmed);
    if (trimmed !== "" && (!Number.isFinite(next) || (next as number) < 0)) {
      toast.error("Enter a valid monthly goal");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ monthly_goal: next });
      setEditing(false);
      toast.success("Monthly goal saved");
    } catch (err) {
      toast.error("Could not save goal", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  async function sharePeriod() {
    const lines = [
      `My ${periodLabel} on TradeFix`,
      `Net P&L: ${formatMoney(stats.netPnl)}`,
      `Win rate: ${stats.winRate}%`,
      `Best day: ${formatMoney(stats.bestDay)}`,
      `Trades: ${stats.trades} · Trading days: ${stats.tradingDays}`,
      `Journaled: ${stats.journaled}`,
    ];
    const text = lines.join("\n");
    try {
      if (navigator.share) {
        await navigator.share({ title: `My ${periodLabel}`, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast.success("Summary copied to clipboard");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(text);
        toast.success("Summary copied to clipboard");
      } catch {
        toast.error("Could not share summary");
      }
    }
  }

  const rows: { label: string; value: string; tone?: "pos" | "neg" }[] = [
    {
      label: "Net P&L",
      value: formatMoney(stats.netPnl),
      tone: stats.netPnl >= 0 ? "pos" : "neg",
    },
    { label: "Win rate", value: `${stats.winRate}%` },
    {
      label: "Best day",
      value: formatMoney(stats.bestDay),
      tone: stats.bestDay >= 0 ? "pos" : "neg",
    },
    { label: "Trades", value: String(stats.trades) },
    { label: "Trading days", value: String(stats.tradingDays) },
    { label: "Journaled", value: String(stats.journaled) },
  ];

  return (
    <aside className="flex w-full shrink-0 flex-col border-t border-[var(--color-border)] bg-[var(--color-surface)] lg:w-[280px] lg:border-l lg:border-t-0">
      <div className="flex-1 space-y-7 overflow-y-auto px-5 py-5">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Monthly goal
            </h2>
            {!editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-md p-1 text-[var(--color-text-tertiary)] transition-colors duration-150 hover:bg-[var(--color-primary-very-light)] hover:text-primary"
                title="Edit monthly goal"
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            )}
          </div>

          {editing ? (
            <div className="space-y-2">
              <div className="flex items-center rounded-md border border-[#E2E2E7] bg-white focus-within:border-primary/40">
                <span className="pl-3 text-sm text-[var(--color-text-secondary)]">{currencySymbol}</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={goalDraft}
                  onChange={(e) => setGoalDraft(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full bg-transparent px-2 py-2 text-sm text-[var(--color-text-primary)] outline-none"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveGoal}
                  disabled={saving}
                  className="dash-btn-primary text-on-accent !h-8 flex-1 !text-xs disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="dash-btn-secondary !h-8 !px-3 !text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p
                className={`font-mono text-[28px] font-semibold leading-tight ${
                  goalCurrent >= 0 ? "text-positive" : "text-negative"
                }`}
              >
                {formatMoney(goalCurrent)}
              </p>
              {monthlyGoal != null && monthlyGoal > 0 ? (
                <p className="mt-1.5 text-[12px] text-[var(--color-text-secondary)]">
                  Target {formatMoney(monthlyGoal, { signed: false })} ·{" "}
                  {Math.max(0, Math.min(100, Math.round((goalCurrent / monthlyGoal) * 100)))}%
                </p>
              ) : (
                <p className="mt-1.5 text-[12px] text-[var(--color-text-tertiary)]">
                  Set a monthly P&L target
                </p>
              )}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Your {periodLabel}
          </h2>
          <dl className="space-y-2.5">
            {rows.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-3">
                <dt className="text-[13px] text-[var(--color-text-secondary)]">{row.label}</dt>
                <dd
                  className={`font-mono text-[13px] font-semibold tabular-nums ${
                    row.tone === "pos"
                      ? "text-positive"
                      : row.tone === "neg"
                        ? "text-negative"
                        : "text-[var(--color-text-primary)]"
                  }`}
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <div className="shrink-0 border-t border-[var(--color-border)] p-4">
        <button
          type="button"
          onClick={sharePeriod}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[#E2E2E7] bg-white text-[13px] font-medium text-[var(--color-text-primary)] transition-colors duration-150 hover:bg-[var(--color-primary-very-light)] hover:text-primary"
        >
          <Share2 className="h-4 w-4" strokeWidth={1.75} />
          Share your {periodLabel}
        </button>
      </div>
    </aside>
  );
}
