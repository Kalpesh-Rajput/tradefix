"use client";

import clsx from "clsx";

import { DailyChecklist } from "@/components/progress/DailyChecklist";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api";
import { useDailyProgress, useManualRuleCompletion, useStartProgressDay } from "@/lib/hooks/useProgressTracker";

export function GamePlanCard({
  date,
  accountId,
  alwaysShow,
  compact,
}: {
  date: string;
  accountId?: string | null;
  alwaysShow?: boolean;
  compact?: boolean;
}) {
  const toast = useToast();
  const { dateKey } = useLocale();
  const daily = useDailyProgress(date, accountId);
  const complete = useManualRuleCompletion();
  const startDay = useStartProgressDay();
  const today = dateKey(new Date());
  const isToday = date === today;

  if (daily.isLoading) {
    return (
      <section className={clsx("dash-card p-4", compact ? undefined : "mb-4")}>
        <div className="h-24 animate-pulse rounded-md bg-[var(--color-primary-very-light)]" />
      </section>
    );
  }

  if (!alwaysShow && (!daily.data || !daily.data.tracking)) return null;

  return (
    <div className={compact ? undefined : "mb-4"}>
      <DailyChecklist
        title="Today's game plan"
        compact={compact}
        day={daily.data}
        today={today}
        starting={startDay.isPending}
        onStartDay={
          isToday
            ? async () => {
                try {
                  await startDay.mutateAsync(date);
                } catch (err) {
                  toast.error(err instanceof ApiError ? err.message : "Could not start today");
                }
              }
            : undefined
        }
        onToggleManual={async (ruleId, completed) => {
          try {
            await complete.mutateAsync({ ruleId, date, completed });
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Could not update that habit");
          }
        }}
      />
    </div>
  );
}
