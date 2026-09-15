"use client";

import { Check, Loader2, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { GoalMetricCard } from "@/components/goals/GoalMetricCard";
import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  SettingsCard,
  SettingsField,
  SettingsPageHeader,
  SettingsShell,
} from "@/components/settings/SettingsShell";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { buildGoalProgressFromCalendar, currentMonthKey } from "@/lib/goals";
import { localIso } from "@/lib/dateLocal";
import { useCalendar } from "@/lib/hooks/useAnalytics";

type GoalsForm = {
  daily_goal: string;
  weekly_goal: string;
  monthly_goal: string;
  yearly_goal: string;
  target_trades: string;
};

function emptyForm(): GoalsForm {
  return {
    daily_goal: "",
    weekly_goal: "",
    monthly_goal: "",
    yearly_goal: "",
    target_trades: "",
  };
}

function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function MoneyInput({
  value,
  onChange,
  currencySymbol,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  currencySymbol: string;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center rounded-lg border border-border bg-background focus-within:border-primary/40">
      <span className="pl-3 text-sm text-muted">{currencySymbol}</span>
      <input
        type="number"
        step="any"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent px-2 py-2.5 text-sm text-foreground outline-none placeholder:text-muted [appearance:textfield] [&::-webkit-inner-spin-button]:opacity-100 [&::-webkit-outer-spin-button]:opacity-100"
      />
    </div>
  );
}

export function GoalsSettingsPage() {
  const { user, loading, updateProfile } = useAuth();
  const { currencySymbol, formatMoney, activeAccount } = useAccountPrefs();
  const toast = useToast();

  const [form, setForm] = useState<GoalsForm>(emptyForm());
  const [baseline, setBaseline] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const now = useMemo(() => new Date(), []);
  const yearStart = `${now.getFullYear()}-01-01`;
  const todayIso = localIso(now);
  const { data: calendar, isLoading: calendarLoading } = useCalendar(
    yearStart,
    todayIso,
    activeAccount?.id,
    { enabled: !!activeAccount?.id }
  );

  useEffect(() => {
    if (!user) return;
    const next: GoalsForm = {
      daily_goal: user.daily_goal != null ? String(user.daily_goal) : "",
      weekly_goal: user.weekly_goal != null ? String(user.weekly_goal) : "",
      monthly_goal: user.monthly_goal != null ? String(user.monthly_goal) : "",
      yearly_goal: user.yearly_goal != null ? String(user.yearly_goal) : "",
      target_trades: user.target_trades != null ? String(user.target_trades) : "",
    };
    setForm(next);
    setBaseline(JSON.stringify(next));
    setSaveState("idle");
    setErrorMsg(null);
  }, [user]);

  const isDirty = Boolean(baseline) && JSON.stringify(form) !== baseline;

  const liveItems = useMemo(
    () => buildGoalProgressFromCalendar(user, calendar?.days ?? [], now),
    [user, calendar?.days, now]
  );

  function handleCancel() {
    if (!user) return;
    setForm({
      daily_goal: user.daily_goal != null ? String(user.daily_goal) : "",
      weekly_goal: user.weekly_goal != null ? String(user.weekly_goal) : "",
      monthly_goal: user.monthly_goal != null ? String(user.monthly_goal) : "",
      yearly_goal: user.yearly_goal != null ? String(user.yearly_goal) : "",
      target_trades: user.target_trades != null ? String(user.target_trades) : "",
    });
    setSaveState("idle");
    setErrorMsg(null);
  }

  async function handleSave() {
    const daily = parseOptionalNumber(form.daily_goal);
    const weekly = parseOptionalNumber(form.weekly_goal);
    const monthly = parseOptionalNumber(form.monthly_goal);
    const yearly = parseOptionalNumber(form.yearly_goal);
    const trades = parseOptionalNumber(form.target_trades);

    if (form.daily_goal.trim() && daily == null) {
      setErrorMsg("Daily P&L must be a number");
      setSaveState("error");
      return;
    }
    if (form.weekly_goal.trim() && weekly == null) {
      setErrorMsg("Weekly P&L must be a number");
      setSaveState("error");
      return;
    }
    if (form.monthly_goal.trim() && monthly == null) {
      setErrorMsg("Monthly P&L must be a number");
      setSaveState("error");
      return;
    }
    if (form.yearly_goal.trim() && yearly == null) {
      setErrorMsg("Yearly P&L must be a number");
      setSaveState("error");
      return;
    }
    if (form.target_trades.trim() && (trades == null || !Number.isInteger(trades))) {
      setErrorMsg("Target trades must be a whole number");
      setSaveState("error");
      return;
    }
    for (const [label, value] of [
      ["Daily P&L", daily],
      ["Weekly P&L", weekly],
      ["Monthly P&L", monthly],
      ["Yearly P&L", yearly],
      ["Target trades", trades],
    ] as const) {
      if (value != null && value < 0) {
        setErrorMsg(`${label} cannot be negative`);
        setSaveState("error");
        return;
      }
    }

    setSaveState("saving");
    setErrorMsg(null);
    try {
      await updateProfile({
        daily_goal: daily,
        weekly_goal: weekly,
        monthly_goal: monthly,
        yearly_goal: yearly,
        target_trades: trades != null ? Math.trunc(trades) : null,
        monthly_goal_ack_month: currentMonthKey(),
      });
      setSaveState("saved");
      toast.success("Goals saved");
      window.setTimeout(() => setSaveState("idle"), 2000);
    } catch (err) {
      setSaveState("error");
      const message = err instanceof Error ? err.message : "Failed to save goals";
      setErrorMsg(message);
      toast.error("Could not save goals", message);
    }
  }

  const symbol = useMemo(() => currencySymbol.trim() || "$", [currencySymbol]);
  const primaryIds = new Set(["daily", "weekly", "monthly"]);
  const primaryItems = liveItems.filter((item) => primaryIds.has(item.id));
  const extraItems = liveItems.filter((item) => !primaryIds.has(item.id));

  if (loading || !user) {
    return (
      <SettingsShell>
        <div className="animate-pulse space-y-5">
          <div className="h-8 w-24 rounded bg-foreground/5" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </SettingsShell>
    );
  }

  return (
    <SettingsShell>
      <SettingsPageHeader
        title="Goals"
        subtitle="Set daily, weekly, and monthly P&L targets. The calendar measures what you’ve earned against each one."
      />

      <div className="space-y-5">
        {calendarLoading && !calendar ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        ) : primaryItems.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {primaryItems.map((item) => (
              <GoalMetricCard key={item.id} item={item} formatMoney={formatMoney} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
            Set a daily, weekly, or monthly target below. Progress vs earned P&L will show here and on the calendar.
          </div>
        )}

        {extraItems.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {extraItems.map((item) => (
              <GoalMetricCard key={item.id} item={item} formatMoney={formatMoney} compact />
            ))}
          </div>
        )}

        <SettingsCard
          title="P&L targets"
          description="These are the numbers the calendar and dashboard use as the goal metric."
        >
          <div className="grid gap-5 sm:grid-cols-3">
            <SettingsField label="Daily P&L" hint="Measured against today’s closed P&L">
              <MoneyInput
                value={form.daily_goal}
                onChange={(daily_goal) => setForm((f) => ({ ...f, daily_goal }))}
                currencySymbol={symbol}
                placeholder="250"
              />
            </SettingsField>
            <SettingsField label="Weekly P&L" hint="Sunday–Saturday calendar week">
              <MoneyInput
                value={form.weekly_goal}
                onChange={(weekly_goal) => setForm((f) => ({ ...f, weekly_goal }))}
                currencySymbol={symbol}
                placeholder="1000"
              />
            </SettingsField>
            <SettingsField label="Monthly P&L" hint="You’ll be asked to confirm this on the 1st">
              <MoneyInput
                value={form.monthly_goal}
                onChange={(monthly_goal) => setForm((f) => ({ ...f, monthly_goal }))}
                currencySymbol={symbol}
                placeholder="5000"
              />
            </SettingsField>
          </div>
        </SettingsCard>

        <SettingsCard title="Longer-term (optional)">
          <div className="grid gap-5 sm:grid-cols-2">
            <SettingsField label="Yearly P&L">
              <MoneyInput
                value={form.yearly_goal}
                onChange={(yearly_goal) => setForm((f) => ({ ...f, yearly_goal }))}
                currencySymbol={symbol}
                placeholder="50000"
              />
            </SettingsField>
            <SettingsField label="Target trades">
              <div className="flex items-center rounded-lg border border-border bg-background focus-within:border-primary/40">
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={form.target_trades}
                  onChange={(e) => setForm((f) => ({ ...f, target_trades: e.target.value }))}
                  placeholder="e.g. 100"
                  className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted"
                />
                <span className="pr-3 text-sm text-muted">trades</span>
              </div>
            </SettingsField>
          </div>
        </SettingsCard>

        <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
          <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            Calendar cells mark days that hit your daily goal. The sidebar and monthly stats show earned vs each target.
          </p>
        </div>

        {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}

        <div className="flex flex-wrap items-center justify-end gap-3">
          {saveState === "saved" && (
            <span className="inline-flex items-center gap-1.5 text-xs text-primary">
              <Check className="h-3.5 w-3.5" />
              Saved
            </span>
          )}
          <Button type="button" variant="ghost" disabled={!isDirty || saveState === "saving"} onClick={handleCancel}>
            Cancel
          </Button>
          <Button type="button" disabled={!isDirty || saveState === "saving"} onClick={handleSave}>
            {saveState === "saving" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </div>
    </SettingsShell>
  );
}
