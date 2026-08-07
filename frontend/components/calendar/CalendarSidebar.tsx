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

  const rows: { label: string; value: string; tone?: "pos" | "neg" | "muted" }[] = [
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
    <aside className="flex w-full shrink-0 flex-col border-t border-white/[0.06] bg-black/40 lg:w-[280px] lg:border-l lg:border-t-0">
      <div className="flex-1 space-y-8 overflow-y-auto px-5 py-6">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Monthly goal
            </h2>
            {!editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-md p-1 text-zinc-500 transition hover:bg-white/5 hover:text-white"
                title="Edit monthly goal"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {editing ? (
            <div className="space-y-2">
              <div className="flex items-center rounded-lg border border-white/10 bg-zinc-950 focus-within:border-primary/40">
                <span className="pl-3 text-sm text-zinc-500">{currencySymbol}</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={goalDraft}
                  onChange={(e) => setGoalDraft(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full bg-transparent px-2 py-2 text-sm text-white outline-none"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveGoal}
                  disabled={saving}
                  className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-primary text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="h-8 rounded-lg border border-white/10 px-3 text-xs text-zinc-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p
                className={`font-mono text-3xl font-semibold ${
                  goalCurrent >= 0 ? "text-primary" : "text-destructive"
                }`}
              >
                {formatMoney(goalCurrent)}
              </p>
              {monthlyGoal != null && monthlyGoal > 0 ? (
                <p className="mt-1 text-[11px] text-zinc-500">
                  Target {formatMoney(monthlyGoal, { signed: false })} ·{" "}
                  {Math.max(0, Math.min(100, Math.round((goalCurrent / monthlyGoal) * 100)))}%
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-zinc-600">Set a monthly P&L target</p>
              )}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Your {periodLabel}
          </h2>
          <dl className="space-y-3">
            {rows.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-3">
                <dt className="text-xs text-zinc-500">{row.label}</dt>
                <dd
                  className={`font-mono text-sm font-medium ${
                    row.tone === "pos"
                      ? "text-primary"
                      : row.tone === "neg"
                        ? "text-destructive"
                        : "text-white"
                  }`}
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <div className="shrink-0 border-t border-white/[0.06] p-4">
        <button
          type="button"
          onClick={sharePeriod}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/10 text-sm text-zinc-300 transition hover:border-white/20 hover:text-white"
        >
          <Share2 className="h-4 w-4" />
          Share your {periodLabel}
        </button>
      </div>
    </aside>
  );
}
