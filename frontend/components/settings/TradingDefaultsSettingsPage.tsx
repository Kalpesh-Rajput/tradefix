"use client";

import clsx from "clsx";
import { Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/providers/AuthProvider";
import {
  SettingsCard,
  SettingsField,
  SettingsInput,
  SettingsPageHeader,
  SettingsShell,
} from "@/components/settings/SettingsShell";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useMasters } from "@/lib/hooks/useMasters";
import { masterNames } from "@/lib/masters";

type EntryDefaults = {
  default_symbol: string;
  default_quantity: string;
  default_fee: string;
  default_forex_leverage: string;
};

function emptyEntry(): EntryDefaults {
  return {
    default_symbol: "",
    default_quantity: "",
    default_fee: "",
    default_forex_leverage: "",
  };
}

function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function TradingDefaultsSettingsPage() {
  const { user, loading, updateProfile } = useAuth();
  const toast = useToast();
  const { data: strategyMasters = [] } = useMasters("strategy");

  const [defaultStrategies, setDefaultStrategies] = useState<string[]>([]);
  const [entry, setEntry] = useState<EntryDefaults>(emptyEntry());
  const [baseline, setBaseline] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const strategyOptions = useMemo(
    () => masterNames(strategyMasters, defaultStrategies),
    [strategyMasters, defaultStrategies]
  );

  useEffect(() => {
    if (!user) return;
    const nextDefaults = user.default_strategies ?? [];
    const nextEntry: EntryDefaults = {
      default_symbol: user.default_symbol ?? "",
      default_quantity: user.default_quantity != null ? String(user.default_quantity) : "",
      default_fee: user.default_fee != null ? String(user.default_fee) : "",
      default_forex_leverage:
        user.default_forex_leverage != null ? String(user.default_forex_leverage) : "",
    };
    setDefaultStrategies(nextDefaults);
    setEntry(nextEntry);
    setBaseline(JSON.stringify({ defaultStrategies: nextDefaults, entry: nextEntry }));
    setSaveState("idle");
    setErrorMsg(null);
  }, [user]);

  const snapshot = useMemo(
    () => JSON.stringify({ defaultStrategies, entry }),
    [defaultStrategies, entry]
  );
  const isDirty = Boolean(baseline) && snapshot !== baseline;

  function toggleDefaultStrategy(label: string) {
    setDefaultStrategies((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]
    );
  }

  async function handleSave() {
    const quantity = parseOptionalNumber(entry.default_quantity);
    const fee = parseOptionalNumber(entry.default_fee);
    const leverage = parseOptionalNumber(entry.default_forex_leverage);

    if (entry.default_quantity.trim() && quantity == null) {
      setErrorMsg("Default quantity must be a number");
      setSaveState("error");
      return;
    }
    if (entry.default_fee.trim() && fee == null) {
      setErrorMsg("Default fee must be a number");
      setSaveState("error");
      return;
    }
    if (entry.default_forex_leverage.trim() && leverage == null) {
      setErrorMsg("Default leverage must be a number");
      setSaveState("error");
      return;
    }
    if (quantity != null && quantity < 0) {
      setErrorMsg("Default quantity cannot be negative");
      setSaveState("error");
      return;
    }
    if (fee != null && fee < 0) {
      setErrorMsg("Default fee cannot be negative");
      setSaveState("error");
      return;
    }
    if (leverage != null && leverage < 0) {
      setErrorMsg("Default leverage cannot be negative");
      setSaveState("error");
      return;
    }

    setSaveState("saving");
    setErrorMsg(null);
    try {
      await updateProfile({
        default_symbol: entry.default_symbol.trim().toUpperCase() || null,
        default_quantity: quantity,
        default_fee: fee,
        default_forex_leverage: leverage,
        default_strategies: defaultStrategies,
      });
      setSaveState("saved");
      toast.success("Trading defaults saved");
      window.setTimeout(() => setSaveState("idle"), 2000);
    } catch (err) {
      setSaveState("error");
      const message = err instanceof Error ? err.message : "Failed to save trading defaults";
      setErrorMsg(message);
      toast.error("Could not save trading defaults", message);
    }
  }

  function handleCancel() {
    if (!user) return;
    const nextDefaults = user.default_strategies ?? [];
    const nextEntry: EntryDefaults = {
      default_symbol: user.default_symbol ?? "",
      default_quantity: user.default_quantity != null ? String(user.default_quantity) : "",
      default_fee: user.default_fee != null ? String(user.default_fee) : "",
      default_forex_leverage:
        user.default_forex_leverage != null ? String(user.default_forex_leverage) : "",
    };
    setDefaultStrategies(nextDefaults);
    setEntry(nextEntry);
    setErrorMsg(null);
    setSaveState("idle");
  }

  if (loading || !user) {
    return (
      <SettingsShell>
        <div className="animate-pulse space-y-5">
          <div className="h-8 w-48 rounded bg-white/5" />
          <div className="h-40 rounded-xl border border-white/[0.06] bg-zinc-950/80" />
        </div>
      </SettingsShell>
    );
  }

  return (
    <SettingsShell>
      <SettingsPageHeader
        title="Trading Defaults"
        subtitle="Entry fields used when you add a trade. Strategies, mistakes, mood, and what went well are managed in Trade masters."
      />

      <div className="space-y-8">
        <SettingsCard
          title="Default Strategies for New Trades"
          description="Pre-selected when you open Add Trade"
        >
          <div className="flex flex-wrap gap-2">
            {strategyOptions.map((label) => {
              const selected = defaultStrategies.some((item) => item.toLowerCase() === label.toLowerCase());
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleDefaultStrategy(label)}
                  aria-pressed={selected}
                  className={clsx(
                    "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                    selected
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-white/[0.08] bg-zinc-950 text-zinc-300 hover:border-white/20 hover:text-white"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Add or remove strategies in{" "}
            <Link href="/settings/masters" className="text-primary hover:underline">
              Trade masters
            </Link>
            .
          </p>
        </SettingsCard>

        <section>
          <div className="mb-4">
            <h3 className="text-base font-semibold text-white">Trade Entry Defaults</h3>
            <p className="mt-1 text-xs text-zinc-500">Pre-filled in the Add Trade form to save time.</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-zinc-950/80 p-5 sm:p-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <SettingsField label="Default Symbol">
                <SettingsInput
                  value={entry.default_symbol}
                  onChange={(e) => setEntry((v) => ({ ...v, default_symbol: e.target.value.toUpperCase() }))}
                  placeholder="e.g. AAPL, ES, EURUSD"
                />
              </SettingsField>
              <SettingsField label="Default Quantity">
                <SettingsInput
                  type="number"
                  step="any"
                  min={0}
                  value={entry.default_quantity}
                  onChange={(e) => setEntry((v) => ({ ...v, default_quantity: e.target.value }))}
                  placeholder="e.g. 100"
                />
              </SettingsField>
              <SettingsField label="Default Fee / Commission">
                <SettingsInput
                  type="number"
                  step="any"
                  min={0}
                  value={entry.default_fee}
                  onChange={(e) => setEntry((v) => ({ ...v, default_fee: e.target.value }))}
                  placeholder="e.g. 1.50"
                />
              </SettingsField>
              <SettingsField label="Default Forex Leverage">
                <SettingsInput
                  type="number"
                  step="any"
                  min={0}
                  value={entry.default_forex_leverage}
                  onChange={(e) => setEntry((v) => ({ ...v, default_forex_leverage: e.target.value }))}
                  placeholder="e.g. 50"
                />
              </SettingsField>
            </div>
          </div>
        </section>

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
          <Button type="button" disabled={!isDirty || saveState === "saving"} onClick={() => void handleSave()}>
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
