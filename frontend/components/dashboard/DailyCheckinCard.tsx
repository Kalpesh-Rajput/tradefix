"use client";

import clsx from "clsx";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useTodayCheckin, useUpsertCheckin } from "@/lib/hooks/useCheckins";
import { resolveStrategyCatalog } from "@/lib/tradingDefaults";
import type { CheckinFollowed } from "@/lib/types";

const FOLLOWED: { value: CheckinFollowed; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "partial", label: "Partial" },
  { value: "no", label: "No" },
];

export function DailyCheckinCard() {
  const { user } = useAuth();
  const { dateKey } = useLocale();
  const { activeAccount } = useAccountPrefs();
  const toast = useToast();
  const today = dateKey(new Date());
  const { data: checkin, isLoading } = useTodayCheckin(today);
  const upsert = useUpsertCheckin();

  const [maxLoss, setMaxLoss] = useState("");
  const [maxTrades, setMaxTrades] = useState("");
  const [focusSetup, setFocusSetup] = useState("");
  const [goalNote, setGoalNote] = useState("");
  const [followed, setFollowed] = useState<CheckinFollowed | null>(null);
  const [eveningNote, setEveningNote] = useState("");

  const setups = resolveStrategyCatalog(user);

  useEffect(() => {
    if (!checkin) {
      setMaxLoss("");
      setMaxTrades("");
      setFocusSetup("");
      setGoalNote("");
      setFollowed(null);
      setEveningNote("");
      return;
    }
    setMaxLoss(checkin.max_loss != null ? String(checkin.max_loss) : "");
    setMaxTrades(checkin.max_trades != null ? String(checkin.max_trades) : "");
    setFocusSetup(checkin.focus_setup ?? "");
    setGoalNote(checkin.goal_note ?? "");
    setFollowed(checkin.followed);
    setEveningNote(checkin.evening_note ?? "");
  }, [checkin]);

  async function save() {
    const loss = maxLoss.trim() ? Number(maxLoss) : null;
    const trades = maxTrades.trim() ? Number(maxTrades) : null;
    if (maxLoss.trim() && !Number.isFinite(loss)) {
      toast.error("Max loss must be a number");
      return;
    }
    if (maxTrades.trim() && (!Number.isFinite(trades) || (trades ?? 0) < 1)) {
      toast.error("Max trades must be a positive number");
      return;
    }
    try {
      await upsert.mutateAsync({
        date: today,
        account_id: activeAccount?.id ?? null,
        max_loss: loss,
        max_trades: trades,
        focus_setup: focusSetup.trim() || null,
        goal_note: goalNote.trim() || null,
        followed,
        evening_note: eveningNote.trim() || null,
      });
      toast.success("Daily check-in saved");
    } catch (err) {
      toast.error("Could not save check-in", err instanceof Error ? err.message : undefined);
    }
  }

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-xl border border-white/[0.06] bg-zinc-950/80 p-5">
        <div className="h-5 w-36 rounded bg-white/5" />
        <div className="mt-4 h-24 rounded bg-white/5" />
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-white/[0.06] bg-zinc-950/80 p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">Daily Check-in</h3>
          <p className="mt-0.5 text-xs text-zinc-500">Set risk limits and focus before you trade.</p>
        </div>
        <Button size="sm" onClick={save} disabled={upsert.isPending}>
          {upsert.isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving…
            </>
          ) : (
            "Save"
          )}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-zinc-500">Max loss</label>
          <Input
            type="number"
            step="any"
            min={0}
            value={maxLoss}
            onChange={(e) => setMaxLoss(e.target.value)}
            placeholder="e.g. 200"
            className="border-white/10 bg-zinc-900"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-zinc-500">Max trades</label>
          <Input
            type="number"
            min={1}
            value={maxTrades}
            onChange={(e) => setMaxTrades(e.target.value)}
            placeholder="e.g. 5"
            className="border-white/10 bg-zinc-900"
          />
        </div>
      </div>

      <div className="mt-3">
        <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-zinc-500">Focus setup</label>
        <div className="flex flex-wrap gap-1.5">
          {setups.slice(0, 12).map((label) => {
            const on = focusSetup === label;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setFocusSetup(on ? "" : label)}
                className={clsx(
                  "rounded-lg border px-2.5 py-1 text-xs transition-colors",
                  on
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-white/10 text-zinc-400 hover:text-white"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3">
        <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-zinc-500">Goal note</label>
        <Input
          value={goalNote}
          onChange={(e) => setGoalNote(e.target.value)}
          placeholder="One thing to protect today…"
          className="border-white/10 bg-zinc-900"
        />
      </div>

      <div className="mt-4 border-t border-white/[0.06] pt-4">
        <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-zinc-500">
          Followed plan?
        </label>
        <div className="mb-3 flex gap-1.5">
          {FOLLOWED.map((opt) => {
            const on = followed === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFollowed(on ? null : opt.value)}
                className={clsx(
                  "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  on
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-white/10 text-zinc-400 hover:text-white"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-zinc-500">
          Evening note
        </label>
        <Textarea
          rows={2}
          value={eveningNote}
          onChange={(e) => setEveningNote(e.target.value)}
          placeholder="How did the session go?"
          className="border-white/10 bg-zinc-900"
        />
      </div>
    </section>
  );
}
