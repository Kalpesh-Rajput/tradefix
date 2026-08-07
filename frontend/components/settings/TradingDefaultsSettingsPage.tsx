"use client";

import clsx from "clsx";
import { Reorder, useDragControls } from "framer-motion";
import { Check, GripVertical, Loader2, Plus, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

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
import { isBuiltinEmotion, resolveEmotionCatalog } from "@/lib/emotions";
import {
  isBuiltinMistake,
  isBuiltinStrategy,
  normalizeLabel,
  resolveMistakeCatalog,
  resolveStrategyCatalog,
} from "@/lib/tradingDefaults";

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

function CatalogRow({
  label,
  canDelete,
  onDelete,
}: {
  label: string;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={label}
      dragListener={false}
      dragControls={controls}
      className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-zinc-950 px-3 py-2.5"
    >
      <button
        type="button"
        aria-label={`Reorder ${label}`}
        className="touch-none text-zinc-600 transition hover:text-zinc-300"
        onPointerDown={(e) => controls.start(e)}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="min-w-0 flex-1 truncate text-sm text-white">{label}</span>
      {canDelete && (
        <button
          type="button"
          aria-label={`Remove ${label}`}
          onClick={onDelete}
          className="text-zinc-500 transition hover:text-destructive"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </Reorder.Item>
  );
}

function AddCatalogRow({
  placeholder,
  onAdd,
}: {
  placeholder: string;
  onAdd: (value: string) => boolean;
}) {
  const [value, setValue] = useState("");

  function submit(e?: FormEvent) {
    e?.preventDefault();
    if (onAdd(value)) setValue("");
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-primary/40"
      />
      <button
        type="submit"
        aria-label="Add"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-zinc-950 text-zinc-400 transition hover:border-primary/40 hover:text-primary"
      >
        <Plus className="h-4 w-4" />
      </button>
    </form>
  );
}

export function TradingDefaultsSettingsPage() {
  const { user, loading, updateProfile } = useAuth();
  const toast = useToast();

  const [strategies, setStrategies] = useState<string[]>([]);
  const [customStrategies, setCustomStrategies] = useState<string[]>([]);
  const [defaultStrategies, setDefaultStrategies] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState<string[]>([]);
  const [customMistakes, setCustomMistakes] = useState<string[]>([]);
  const [emotions, setEmotions] = useState<string[]>([]);
  const [customEmotions, setCustomEmotions] = useState<string[]>([]);
  const [entry, setEntry] = useState<EntryDefaults>(emptyEntry());
  const [baseline, setBaseline] = useState<string>("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const nextStrategies = resolveStrategyCatalog(user);
    const nextMistakes = resolveMistakeCatalog(user);
    const nextEmotions = resolveEmotionCatalog(user);
    const nextCustomStrategies = user.custom_strategies ?? [];
    const nextCustomMistakes = user.custom_mistakes ?? [];
    const nextCustomEmotions = user.custom_emotion_tags ?? [];
    const nextDefaults = (user.default_strategies ?? []).filter((s) => nextStrategies.includes(s));
    const nextEntry: EntryDefaults = {
      default_symbol: user.default_symbol ?? "",
      default_quantity: user.default_quantity != null ? String(user.default_quantity) : "",
      default_fee: user.default_fee != null ? String(user.default_fee) : "",
      default_forex_leverage:
        user.default_forex_leverage != null ? String(user.default_forex_leverage) : "",
    };

    setStrategies(nextStrategies);
    setCustomStrategies(nextCustomStrategies);
    setDefaultStrategies(nextDefaults);
    setMistakes(nextMistakes);
    setCustomMistakes(nextCustomMistakes);
    setEmotions(nextEmotions);
    setCustomEmotions(nextCustomEmotions);
    setEntry(nextEntry);
    setBaseline(
      JSON.stringify({
        strategies: nextStrategies,
        customStrategies: nextCustomStrategies,
        defaultStrategies: nextDefaults,
        mistakes: nextMistakes,
        customMistakes: nextCustomMistakes,
        emotions: nextEmotions,
        customEmotions: nextCustomEmotions,
        entry: nextEntry,
      })
    );
    setSaveState("idle");
    setErrorMsg(null);
  }, [user]);

  const snapshot = useMemo(
    () =>
      JSON.stringify({
        strategies,
        customStrategies,
        defaultStrategies,
        mistakes,
        customMistakes,
        emotions,
        customEmotions,
        entry,
      }),
    [strategies, customStrategies, defaultStrategies, mistakes, customMistakes, emotions, customEmotions, entry]
  );

  const isDirty = Boolean(baseline) && snapshot !== baseline;

  function toggleDefaultStrategy(label: string) {
    setDefaultStrategies((prev) =>
      prev.includes(label) ? prev.filter((s) => s !== label) : [...prev, label]
    );
  }

  function addStrategy(raw: string): boolean {
    const label = normalizeLabel(raw);
    if (!label) {
      toast.error("Enter a strategy name");
      return false;
    }
    if (strategies.some((s) => s.toLowerCase() === label.toLowerCase())) {
      toast.error("Strategy already exists");
      return false;
    }
    setStrategies((prev) => [...prev, label]);
    setCustomStrategies((prev) => [...prev, label]);
    return true;
  }

  function removeStrategy(label: string) {
    if (isBuiltinStrategy(label)) return;
    setStrategies((prev) => prev.filter((s) => s !== label));
    setCustomStrategies((prev) => prev.filter((s) => s !== label));
    setDefaultStrategies((prev) => prev.filter((s) => s !== label));
  }

  function addMistake(raw: string): boolean {
    const label = normalizeLabel(raw);
    if (!label) {
      toast.error("Enter a tag name");
      return false;
    }
    if (mistakes.some((s) => s.toLowerCase() === label.toLowerCase())) {
      toast.error("Tag already exists");
      return false;
    }
    setMistakes((prev) => [...prev, label]);
    setCustomMistakes((prev) => [...prev, label]);
    return true;
  }

  function removeMistake(label: string) {
    if (isBuiltinMistake(label)) return;
    setMistakes((prev) => prev.filter((s) => s !== label));
    setCustomMistakes((prev) => prev.filter((s) => s !== label));
  }

  function addEmotion(raw: string): boolean {
    const label = normalizeLabel(raw);
    if (!label) {
      toast.error("Enter an emotion name");
      return false;
    }
    if (emotions.some((s) => s.toLowerCase() === label.toLowerCase())) {
      toast.error("Emotion already exists");
      return false;
    }
    setEmotions((prev) => [...prev, label]);
    setCustomEmotions((prev) => [...prev, label]);
    return true;
  }

  function removeEmotion(label: string) {
    if (isBuiltinEmotion(label)) return;
    setEmotions((prev) => prev.filter((s) => s !== label));
    setCustomEmotions((prev) => prev.filter((s) => s !== label));
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
        default_strategies: defaultStrategies.filter((s) => strategies.includes(s)),
        custom_strategies: customStrategies,
        strategy_order: strategies,
        custom_mistakes: customMistakes,
        mistake_order: mistakes,
        custom_emotion_tags: customEmotions,
        emotion_tag_order: emotions,
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
    setStrategies(resolveStrategyCatalog(user));
    setCustomStrategies(user.custom_strategies ?? []);
    setDefaultStrategies(
      (user.default_strategies ?? []).filter((s) => resolveStrategyCatalog(user).includes(s))
    );
    setMistakes(resolveMistakeCatalog(user));
    setCustomMistakes(user.custom_mistakes ?? []);
    setEmotions(resolveEmotionCatalog(user));
    setCustomEmotions(user.custom_emotion_tags ?? []);
    setEntry({
      default_symbol: user.default_symbol ?? "",
      default_quantity: user.default_quantity != null ? String(user.default_quantity) : "",
      default_fee: user.default_fee != null ? String(user.default_fee) : "",
      default_forex_leverage:
        user.default_forex_leverage != null ? String(user.default_forex_leverage) : "",
    });
    setSaveState("idle");
    setErrorMsg(null);
  }

  if (loading || !user) {
    return (
      <SettingsShell>
        <div className="animate-pulse space-y-5">
          <div className="h-8 w-48 rounded bg-white/5" />
          <div className="h-40 rounded-xl border border-white/[0.06] bg-zinc-950/80" />
          <div className="h-64 rounded-xl border border-white/[0.06] bg-zinc-950/80" />
        </div>
      </SettingsShell>
    );
  }

  return (
    <SettingsShell>
      <SettingsPageHeader
        title="Trading Defaults"
        subtitle="Strategies, tags, and entry fields used when you add a trade."
      />

      <div className="space-y-8">
        <SettingsCard
          title="Default Strategies for New Trades"
          description="Pre-selected when you open Add Trade"
        >
          <div className="flex flex-wrap gap-2">
            {strategies.map((label) => {
              const selected = defaultStrategies.includes(label);
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
        </SettingsCard>

        <section>
          <h3 className="mb-3 text-base font-semibold text-white">Strategies</h3>
          <div className="space-y-2">
            <Reorder.Group
              axis="y"
              values={strategies}
              onReorder={setStrategies}
              className="space-y-2"
            >
              {strategies.map((label) => (
                <CatalogRow
                  key={label}
                  label={label}
                  canDelete={!isBuiltinStrategy(label)}
                  onDelete={() => removeStrategy(label)}
                />
              ))}
            </Reorder.Group>
            <AddCatalogRow placeholder="Add custom strategy..." onAdd={addStrategy} />
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-base font-semibold text-white">Mistakes & Tags</h3>
          <div className="space-y-2">
            <Reorder.Group axis="y" values={mistakes} onReorder={setMistakes} className="space-y-2">
              {mistakes.map((label) => (
                <CatalogRow
                  key={label}
                  label={label}
                  canDelete={!isBuiltinMistake(label)}
                  onDelete={() => removeMistake(label)}
                />
              ))}
            </Reorder.Group>
            <AddCatalogRow placeholder="Add custom tag..." onAdd={addMistake} />
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-base font-semibold text-white">Emotion Tags</h3>
          <div className="space-y-2">
            <Reorder.Group axis="y" values={emotions} onReorder={setEmotions} className="space-y-2">
              {emotions.map((label) => (
                <CatalogRow
                  key={label}
                  label={label}
                  canDelete={!isBuiltinEmotion(label)}
                  onDelete={() => removeEmotion(label)}
                />
              ))}
            </Reorder.Group>
            <AddCatalogRow placeholder="Add custom emotion..." onAdd={addEmotion} />
          </div>
        </section>

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
                  onChange={(e) =>
                    setEntry((v) => ({ ...v, default_symbol: e.target.value.toUpperCase() }))
                  }
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
                  onChange={(e) =>
                    setEntry((v) => ({ ...v, default_forex_leverage: e.target.value }))
                  }
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
