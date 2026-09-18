"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { CurrentRulesTable } from "@/components/progress/CurrentRulesTable";
import { DailyChecklist } from "@/components/progress/DailyChecklist";
import { DisciplineHeatmap } from "@/components/progress/DisciplineHeatmap";
import { EditRulesModal } from "@/components/progress/EditRulesModal";
import { ProgressMetrics } from "@/components/progress/ProgressMetrics";
import { ProgressTrackerHeader } from "@/components/progress/ProgressTrackerHeader";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api";
import { localIso } from "@/lib/dateLocal";
import {
  useManualRuleCompletion,
  useProgressSummary,
  useResetProgress,
  useSaveProgressSettings,
} from "@/lib/hooks/useProgressTracker";
import { myDayHref } from "@/lib/my-day";

function defaultRange() {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth() - 5, 1);
  return { from: localIso(start), to: localIso(end) };
}

export function ProgressTrackerWorkspace() {
  const toast = useToast();
  const { timezone } = useLocale();
  const initial = useMemo(() => defaultRange(), []);
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [focusDate, setFocusDate] = useState<string>(() => localIso(new Date()));
  const [editOpen, setEditOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const summary = useProgressSummary(dateFrom, dateTo, { accountId, focusDate });
  const save = useSaveProgressSettings();
  const reset = useResetProgress();
  const complete = useManualRuleCompletion();

  const data = summary.data;
  const loading = summary.isLoading;
  const checklist = data?.checklist;
  const checklistTitle = `Daily checklist, ${formatShort(focusDate)}`;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[var(--color-background)]">
      <ProgressTrackerHeader
        dateFrom={dateFrom}
        dateTo={dateTo}
        onRangeChange={(from, to) => {
          setDateFrom(from);
          setDateTo(to);
        }}
        accountId={accountId}
        onAccountChange={setAccountId}
      />
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pt-3 pb-4 sm:px-5">
        {summary.isError ? (
          <div className="dash-card border-destructive/30 bg-destructive/5 px-4 py-6 text-sm">
            Couldn’t load Progress Tracker. Refresh and try again.
            <button type="button" className="ml-3 text-primary" onClick={() => void summary.refetch()}>
              Retry
            </button>
          </div>
        ) : (
          <>
            <ProgressMetrics
              streak={data?.current_streak ?? 0}
              periodScore={data?.period_score ?? null}
              todayPassed={data?.today_passed ?? 0}
              todayTotal={data?.today_total ?? 0}
              loading={loading}
            />
            <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
              <DailyChecklist
                title={checklistTitle}
                day={checklist}
                loading={loading}
                togglingId={togglingId}
                footer={
                  <Link
                    href={myDayHref(focusDate)}
                    className="mt-3 inline-flex text-[12px] font-medium text-primary hover:underline"
                  >
                    Open My Day
                  </Link>
                }
                onToggleManual={async (ruleId, completed) => {
                  setTogglingId(ruleId);
                  try {
                    await complete.mutateAsync({ ruleId, date: focusDate, completed });
                  } catch (err) {
                    toast.error(err instanceof ApiError ? err.message : "Could not update that habit");
                  } finally {
                    setTogglingId(null);
                  }
                }}
              />
              <DisciplineHeatmap
                cells={data?.heatmap ?? []}
                loading={loading}
                selectedDate={focusDate}
                onSelectDate={(date) => {
                  setFocusDate(date);
                }}
              />
            </div>
            <CurrentRulesTable
              rows={data?.rules ?? []}
              loading={loading}
              onEdit={() => setEditOpen(true)}
            />
          </>
        )}
      </div>
      <EditRulesModal
        open={editOpen}
        settings={data?.settings}
        timezoneLabel={data?.timezone || timezone}
        saving={save.isPending}
        resetting={reset.isPending}
        onClose={() => setEditOpen(false)}
        onSave={async (payload) => {
          try {
            await save.mutateAsync(payload);
            setEditOpen(false);
            toast.success("Rules saved");
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Could not save rules");
          }
        }}
        onReset={async () => {
          try {
            await reset.mutateAsync();
            toast.success("Progress history reset");
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Could not reset progress");
          }
        }}
      />
    </div>
  );
}

function formatShort(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
