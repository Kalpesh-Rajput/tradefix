"use client";

import { Check, Loader2, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  SettingsCard,
  SettingsField,
  SettingsPageHeader,
  SettingsShell,
} from "@/components/settings/SettingsShell";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

type GoalsForm = {
  weekly_goal: string;
  monthly_goal: string;
  yearly_goal: string;
  target_trades: string;
};

function emptyForm(): GoalsForm {
  return {
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
    <div className="flex items-center rounded-lg border border-white/10 bg-black focus-within:border-primary/40">
      <span className="pl-3 text-sm text-zinc-500">{currencySymbol}</span>
      <input
        type="number"
        step="any"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent px-2 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 [appearance:textfield] [&::-webkit-inner-spin-button]:opacity-100 [&::-webkit-outer-spin-button]:opacity-100"
      />
    </div>
  );
}

export function GoalsSettingsPage() {
  const { user, loading, updateProfile } = useAuth();
  const { currencySymbol } = useAccountPrefs();
  const toast = useToast();

  const [form, setForm] = useState<GoalsForm>(emptyForm());
  const [baseline, setBaseline] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const next: GoalsForm = {
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

  function handleCancel() {
    if (!user) return;
    setForm({
      weekly_goal: user.weekly_goal != null ? String(user.weekly_goal) : "",
      monthly_goal: user.monthly_goal != null ? String(user.monthly_goal) : "",
      yearly_goal: user.yearly_goal != null ? String(user.yearly_goal) : "",
      target_trades: user.target_trades != null ? String(user.target_trades) : "",
    });
    setSaveState("idle");
    setErrorMsg(null);
  }

  async function handleSave() {
    const weekly = parseOptionalNumber(form.weekly_goal);
    const monthly = parseOptionalNumber(form.monthly_goal);
    const yearly = parseOptionalNumber(form.yearly_goal);
    const trades = parseOptionalNumber(form.target_trades);

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
        weekly_goal: weekly,
        monthly_goal: monthly,
        yearly_goal: yearly,
        target_trades: trades != null ? Math.trunc(trades) : null,
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

  if (loading || !user) {
    return (
      <SettingsShell>
        <div className="animate-pulse space-y-5">
          <div className="h-8 w-24 rounded bg-white/5" />
          <div className="h-40 rounded-xl border border-white/[0.06] bg-zinc-950/80" />
          <div className="h-28 rounded-xl border border-white/[0.06] bg-zinc-950/80" />
        </div>
      </SettingsShell>
    );
  }

  return (
    <SettingsShell>
      <SettingsPageHeader title="Goals" />

      <div className="space-y-5">
        <SettingsCard title="P&L Targets">
          <div className="grid gap-5 sm:grid-cols-3">
            <SettingsField label="Weekly P&L">
              <MoneyInput
                value={form.weekly_goal}
                onChange={(weekly_goal) => setForm((f) => ({ ...f, weekly_goal }))}
                currencySymbol={symbol}
                placeholder="1000"
              />
            </SettingsField>
            <SettingsField label="Monthly P&L">
              <MoneyInput
                value={form.monthly_goal}
                onChange={(monthly_goal) => setForm((f) => ({ ...f, monthly_goal }))}
                currencySymbol={symbol}
                placeholder="5000"
              />
            </SettingsField>
            <SettingsField label="Yearly P&L">
              <MoneyInput
                value={form.yearly_goal}
                onChange={(yearly_goal) => setForm((f) => ({ ...f, yearly_goal }))}
                currencySymbol={symbol}
                placeholder="50000"
              />
            </SettingsField>
          </div>
        </SettingsCard>

        <SettingsCard title="Trade Count Targets (Optional)">
          <SettingsField label="Target Trades">
            <div className="flex items-center rounded-lg border border-white/10 bg-black focus-within:border-primary/40">
              <input
                type="number"
                min={0}
                step={1}
                value={form.target_trades}
                onChange={(e) => setForm((f) => ({ ...f, target_trades: e.target.value }))}
                placeholder="e.g. 100"
                className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600"
              />
              <span className="pr-3 text-sm text-zinc-500">trades</span>
            </div>
          </SettingsField>
        </SettingsCard>

        <div className="flex items-start gap-2.5 rounded-lg border border-primary/25 bg-primary/10 px-4 py-3 text-sm text-primary">
          <Target className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Goals appear as progress indicators on your Today and Analytics pages.</p>
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
