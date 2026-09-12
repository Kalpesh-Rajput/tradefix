"use client";

import { PanelLeft } from "lucide-react";
import { useMemo } from "react";

import { RecapForm, type RecapFormValues } from "@/components/journal/RecapForm";
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

export function NotebookRecapPanel({
  accountId,
  date,
  onDirtyChange,
  onToggleFolders,
}: {
  accountId: string;
  date: string;
  onDirtyChange?: (dirty: boolean) => void;
  onToggleFolders?: () => void;
}) {
  const toast = useToast();
  const { locale } = useLocale();
  const { data: recaps = [], isLoading } = useRecaps(accountId);
  const upsert = useUpsertRecap();
  const remove = useDeleteRecap();
  const uploadShot = useUploadRecapScreenshot();
  const deleteShot = useDeleteRecapScreenshot();
  const { data: dayPnl } = useDayPnl(accountId, date);

  const existing = recaps.find((r) => r.date.slice(0, 10) === date) ?? null;
  const dateLabel = parseLocalIso(date).toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const recapNumber = useMemo(() => {
    if (existing) return existing.recap_number;
    return recaps.reduce((max, recap) => Math.max(max, recap.recap_number), 0) + 1;
  }, [existing, recaps]);

  async function handleSave(values: RecapFormValues, pendingShots: File[]) {
    try {
      const saved = await upsert.mutateAsync({
        account_id: accountId,
        date,
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
      toast.success("Recap saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save recap");
      throw err;
    }
  }

  async function handleDelete() {
    if (!existing) return;
    try {
      await remove.mutateAsync({ id: existing.id, accountId });
      toast.success("Recap deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
      throw err;
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3 p-5">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--color-surface)]">
      <header className="flex h-11 shrink-0 items-center gap-1 border-b border-[var(--color-border)] px-2">
        {onToggleFolders ? (
          <button
            type="button"
            onClick={onToggleFolders}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-very-light)]"
            aria-label="Toggle folders"
          >
            <PanelLeft className="h-4 w-4" strokeWidth={1.75} />
          </button>
        ) : null}
        <h2 className="min-w-0 truncate text-[13px] font-semibold text-[var(--color-text-primary)]">{dateLabel}</h2>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        <RecapForm
          key={`${date}-${existing?.id ?? "draft"}`}
          tone="notebook"
          dateLabel={dateLabel}
          recapNumber={recapNumber}
          existing={existing}
          dayPnl={dayPnl}
          saving={upsert.isPending || uploadShot.isPending}
          onDirtyChange={onDirtyChange}
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
      </div>
    </div>
  );
}
