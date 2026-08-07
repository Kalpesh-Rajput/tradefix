"use client";

import { useMemo, useState } from "react";

import { JournalEmptyState } from "@/components/journal/JournalEmptyState";
import { JournalSidebar, type JournalListItem } from "@/components/journal/JournalSidebar";
import { RecapForm, type RecapFormValues } from "@/components/journal/RecapForm";
import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { parseLocalIso } from "@/lib/dateLocal";
import {
  useDayPnl,
  useDeleteRecap,
  useDeleteRecapScreenshot,
  useRecaps,
  useUploadRecapScreenshot,
  useUpsertRecap,
} from "@/lib/hooks/useRecaps";
import type { DailyRecap } from "@/lib/types";

function formatEntryLabel(iso: string, todayKey: string, locale: string): string {
  const d = parseLocalIso(iso);
  const weekday = d.toLocaleDateString(locale, { weekday: "short" });
  const month = d.toLocaleDateString(locale, { month: "short" });
  const day = d.getDate();
  if (iso === todayKey) return `Today · ${weekday}, ${month} ${day}`;
  return `${weekday}, ${month} ${day}`;
}

function moodSubtitle(recap: DailyRecap | null): string {
  if (!recap) return "No recap yet";
  if (recap.day_mood === "good") return "Good day";
  if (recap.day_mood === "mixed") return "Mixed";
  if (recap.day_mood === "tough") return "Tough day";
  return "Recap saved";
}

export function JournalPage() {
  const toast = useToast();
  const { activeAccount, loading: accountsLoading } = useAccountPrefs();
  const { locale, dateKey } = useLocale();
  const accountId = activeAccount?.id;
  const todayKey = dateKey(new Date());

  const { data: recaps = [], isLoading: recapsLoading } = useRecaps(accountId);
  const upsert = useUpsertRecap();
  const remove = useDeleteRecap();
  const uploadShot = useUploadRecapScreenshot();
  const deleteShot = useDeleteRecapScreenshot();

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);

  const recapByDate = useMemo(() => {
    const map = new Map<string, DailyRecap>();
    for (const r of recaps) map.set(r.date.slice(0, 10), r);
    return map;
  }, [recaps]);

  const activeDate = selectedDate ?? todayKey;
  const existing = recapByDate.get(activeDate) ?? null;
  const showForm = composing || !!existing;

  const { data: dayPnl } = useDayPnl(accountId, showForm ? activeDate : undefined);

  const items: JournalListItem[] = useMemo(() => {
    const dates = new Set<string>([todayKey]);
    for (const r of recaps) dates.add(r.date.slice(0, 10));
    return Array.from(dates)
      .sort((a, b) => b.localeCompare(a))
      .map((date) => {
        const recap = recapByDate.get(date) ?? null;
        return {
          date,
          label: formatEntryLabel(date, todayKey, locale),
          subtitle: moodSubtitle(recap),
          recap,
          isToday: date === todayKey,
        };
      });
  }, [recaps, recapByDate, todayKey, locale]);

  const nextRecapNumber = useMemo(() => {
    if (existing) return existing.recap_number;
    const max = recaps.reduce((m, r) => Math.max(m, r.recap_number), 0);
    return max + 1;
  }, [existing, recaps]);

  const openToday = () => {
    setSelectedDate(todayKey);
    setComposing(true);
  };

  const handleSelect = (date: string) => {
    setSelectedDate(date);
    // Saved recap → show form. Today without recap → empty state. Other empty dates → compose.
    if (recapByDate.has(date)) {
      setComposing(false);
    } else if (date === todayKey) {
      setComposing(false);
    } else {
      setComposing(true);
    }
  };

  const handleSave = async (values: RecapFormValues, pendingShots: File[]) => {
    if (!accountId) {
      toast.error("No account selected");
      throw new Error("No account");
    }
    try {
      const saved = await upsert.mutateAsync({
        account_id: accountId,
        date: activeDate,
        day_mood: values.day_mood,
        work_on: values.work_on,
        best_decision: values.best_decision || null,
        reflection: values.reflection || null,
        pnl_override: values.pnl_override,
        gross_pnl: values.pnl_override ? values.gross_pnl : null,
        fees: values.pnl_override ? values.fees : null,
        net_pnl: values.pnl_override ? values.net_pnl : null,
      });

      for (const file of pendingShots) {
        await uploadShot.mutateAsync({ id: saved.id, file });
      }

      setComposing(false);
      setSelectedDate(saved.date.slice(0, 10));
      toast.success("Recap saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save recap");
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!existing || !accountId) return;
    try {
      await remove.mutateAsync({ id: existing.id, accountId });
      setComposing(false);
      setSelectedDate(todayKey);
      toast.success("Recap deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
      throw err;
    }
  };

  const loading = accountsLoading || (!!accountId && recapsLoading);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col md:flex-row">
      <JournalSidebar
        items={items}
        selectedDate={activeDate}
        onSelect={handleSelect}
        onAddToday={openToday}
        loading={loading}
        entryCount={Math.max(items.length, recaps.length)}
      />

      <div className="relative min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        {loading ? (
          <div className="mx-auto max-w-3xl space-y-4">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
        ) : !accountId ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            Create an account in Settings to start journaling.
          </div>
        ) : showForm ? (
          <RecapForm
            key={`${activeDate}-${existing?.id ?? "draft"}`}
            dateLabel={formatEntryLabel(activeDate, todayKey, locale)}
            recapNumber={nextRecapNumber}
            existing={existing}
            dayPnl={dayPnl}
            saving={upsert.isPending || uploadShot.isPending}
            onSave={handleSave}
            onDelete={existing ? handleDelete : undefined}
            onUploadScreenshot={
              existing
                ? async (file) => {
                    await uploadShot.mutateAsync({ id: existing.id, file });
                  }
                : undefined
            }
            onDeleteScreenshot={
              existing
                ? async (url) => {
                    await deleteShot.mutateAsync({ id: existing.id, url });
                  }
                : undefined
            }
          />
        ) : (
          <JournalEmptyState onAdd={openToday} />
        )}
      </div>
    </div>
  );
}
