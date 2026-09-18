"use client";

import { DayPlanGamePlan } from "@/components/my-day/DayPlanGamePlan";
import { RecapForm, type RecapFormValues } from "@/components/journal/RecapForm";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useDayPlan } from "@/lib/hooks/useDayPlan";
import { ApiError } from "@/lib/api";
import {
  useDayPnl,
  useDeleteRecap,
  useDeleteRecapScreenshot,
  useRecaps,
  useUploadRecapScreenshot,
  useUpsertRecap,
} from "@/lib/hooks/useRecaps";

export function MyDayReviewPanel({
  date,
  dateLabel,
  accountId,
}: {
  date: string;
  dateLabel: string;
  accountId: string;
}) {
  const toast = useToast();
  const { data: recaps = [], isLoading } = useRecaps(accountId);
  const planQuery = useDayPlan(accountId, date);
  const { data: dayPnl } = useDayPnl(accountId, date);
  const upsert = useUpsertRecap();
  const remove = useDeleteRecap();
  const uploadShot = useUploadRecapScreenshot();
  const deleteShot = useDeleteRecapScreenshot();
  const existing = recaps.find((r) => r.date.slice(0, 10) === date) ?? null;
  const recapNumber = existing?.recap_number ?? recaps.reduce((m, r) => Math.max(m, r.recap_number), 0) + 1;

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
      toast.error(err instanceof ApiError ? err.message : "Couldn’t save recap");
      throw err;
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <DayPlanGamePlan plan={planQuery.data} accountId={accountId} date={date} loading={planQuery.isLoading} />
      <div className="mt-3">
        <RecapForm
          key={`${date}-${existing?.id ?? "draft"}`}
          dateLabel={dateLabel}
          recapNumber={recapNumber}
          existing={existing}
          dayPnl={dayPnl}
          saving={upsert.isPending || uploadShot.isPending}
          tone="notebook"
          onSave={handleSave}
          onDelete={
            existing
              ? async () => {
                  await remove.mutateAsync({ id: existing.id, accountId });
                  toast.success("Recap deleted");
                }
              : undefined
          }
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
