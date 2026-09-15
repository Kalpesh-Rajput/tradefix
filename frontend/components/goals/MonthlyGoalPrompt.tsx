"use client";

import { usePathname } from "next/navigation";
import { Check, Loader2, Target, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import { currentMonthKey } from "@/lib/goals";

function monthTitle(d = new Date()) {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function MonthlyGoalPrompt() {
  const pathname = usePathname();
  const { user, updateProfile } = useAuth();
  const { currencySymbol } = useAccountPrefs();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const monthKey = currentMonthKey();

  useEffect(() => {
    if (!user) return;
    if (pathname?.startsWith("/settings/goals")) {
      setOpen(false);
      return;
    }
    if (user.monthly_goal_ack_month === monthKey) {
      setOpen(false);
      return;
    }
    setDraft(user.monthly_goal != null && user.monthly_goal > 0 ? String(user.monthly_goal) : "");
    setOpen(true);
  }, [user, monthKey, pathname]);

  async function ack(monthlyGoal: number | null) {
    setSaving(true);
    try {
      await updateProfile({
        monthly_goal: monthlyGoal,
        monthly_goal_ack_month: monthKey,
      });
      setOpen(false);
      if (monthlyGoal != null && monthlyGoal > 0) {
        toast.success("Monthly goal set", `${monthTitle()} target saved`);
      }
    } catch (err) {
      toast.error("Could not save monthly goal", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    const trimmed = draft.trim();
    if (!trimmed) {
      toast.error("Enter a monthly P&L target");
      return;
    }
    const next = Number(trimmed);
    if (!Number.isFinite(next) || next < 0) {
      toast.error("Enter a valid monthly goal");
      return;
    }
    await ack(next);
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/45" aria-label="Dismiss" onClick={() => ack(user?.monthly_goal ?? null)} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="monthly-goal-title"
        className="relative z-10 w-full max-w-[440px] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_24px_80px_rgba(20,16,40,0.22)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-primary-very-light)] text-primary">
              <Target className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div>
              <h2 id="monthly-goal-title" className="text-[16px] font-semibold tracking-tight text-[var(--color-text-primary)]">
                Set {monthTitle()} goal
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                New month. Set a P&L target so the calendar can measure what you earn against it.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => ack(user?.monthly_goal ?? null)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-tertiary)] hover:bg-[var(--color-primary-very-light)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Monthly P&L target
          </label>
          <div className="flex items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] focus-within:border-primary/40">
            <span className="pl-3 text-sm text-[var(--color-text-secondary)]">{currencySymbol}</span>
            <input
              type="number"
              min={0}
              step="any"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="5000"
              className="w-full bg-transparent px-2 py-2.5 text-sm text-[var(--color-text-primary)] outline-none"
              autoFocus
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => ack(user?.monthly_goal ?? null)}
            className="dash-btn-secondary !h-9 !px-3 !text-xs disabled:opacity-50"
          >
            Later
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="dash-btn-primary !h-9 !px-3 !text-xs disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Set monthly goal
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
