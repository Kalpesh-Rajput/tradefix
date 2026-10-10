"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { CurrentRulesTable } from "@/components/progress/CurrentRulesTable";
import { DailyChecklist } from "@/components/progress/DailyChecklist";
import { DisciplineFocusCard } from "@/components/progress/DisciplineFocus";
import { DisciplineHeatmap } from "@/components/progress/DisciplineHeatmap";
import { EditRulesModal } from "@/components/progress/EditRulesModal";
import { ProgressMetrics } from "@/components/progress/ProgressMetrics";
import { ProgressSetup } from "@/components/progress/ProgressSetup";
import { ProgressTrackerHeader } from "@/components/progress/ProgressTrackerHeader";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api";
import { usePublishAssistantScope } from "@/lib/ai/assistant-scope";
import { localIso } from "@/lib/dateLocal";
import {
  disciplineSnapshot,
  isValidIsoDate,
  isoDay,
  recommendedSettings,
  rulesAreActive,
} from "@/lib/progress-tracker/discipline";
import {
  useManualRuleCompletion,
  useProgressSummary,
  useResetProgress,
  useSaveProgressSettings,
  useStartProgressDay,
} from "@/lib/hooks/useProgressTracker";
import { myDayHref } from "@/lib/my-day";

function defaultRange(focus: string | null) {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth() - 5, 1);
  let from = localIso(start);
  let to = localIso(end);
  if (focus && focus < from) from = focus;
  if (focus && focus > to) to = focus;
  return { from, to };
}

export function ProgressTrackerWorkspace() {
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { timezone } = useLocale();
  const queried = isValidIsoDate(searchParams.get("date")) ? searchParams.get("date") : null;
  const initial = useMemo(() => defaultRange(queried), [queried]);
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  usePublishAssistantScope({ dateFrom, dateTo });
  const [accountId, setAccountId] = useState<string | null>(null);
  const [focusDate, setFocusDate] = useState<string>(() => queried ?? localIso(new Date()));
  const [editOpen, setEditOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const picked = useRef(Boolean(queried));

  const summary = useProgressSummary(dateFrom, dateTo, { accountId, focusDate });
  const save = useSaveProgressSettings();
  const reset = useResetProgress();
  const complete = useManualRuleCompletion();
  const startDay = useStartProgressDay();

  const data = summary.data;
  const loading = summary.isLoading;
  const active = rulesAreActive(data?.settings);
  const snapshot = data ? disciplineSnapshot(data) : null;
  const todayIso = data ? isoDay(data.today) : "";
  const todayCell = data?.heatmap.find((cell) => isoDay(cell.date) === todayIso);
  const viewingToday = focusDate === todayIso;
  const canStartToday = Boolean(
    active && todayCell && todayCell.is_trading_day && todayCell.tracking && !todayCell.participated && !todayCell.future
  );

  useEffect(() => {
    const date = searchParams.get("date");
    if (!isValidIsoDate(date)) return;
    picked.current = true;
    setFocusDate(date);
    setDateFrom((prev) => (date < prev ? date : prev));
    setDateTo((prev) => (date > prev ? date : prev));
  }, [searchParams]);

  useEffect(() => {
    if (!data?.today || picked.current) return;
    setFocusDate(isoDay(data.today));
  }, [data?.today]);

  function selectDate(date: string) {
    picked.current = true;
    setFocusDate(date);
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", date);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  async function handleStartToday() {
    try {
      await startDay.mutateAsync(todayIso || undefined);
      toast.success("Today is started");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not start today");
    }
  }

  const streakNote = !todayCell
    ? "Includes today when this range covers it."
    : !todayCell.is_trading_day
      ? "Today is outside your trading days, so the streak waits."
      : todayCell.participated
        ? "Today counts toward the streak."
        : "Start today to keep the streak alive.";

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
            Couldn’t load Progress Tracker.
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
              scoredDays={snapshot?.scoredDays ?? 0}
              cleanDays={snapshot?.cleanDays ?? 0}
              loading={loading}
              streakNote={streakNote}
              onStartToday={canStartToday ? handleStartToday : undefined}
              starting={startDay.isPending}
            />
            {!loading && data?.settings && !active ? (
              <ProgressSetup
                settings={data.settings}
                saving={save.isPending}
                onChoose={() => setEditOpen(true)}
                onUseRecommended={async () => {
                  try {
                    await save.mutateAsync(recommendedSettings(data.settings));
                    toast.success("Recommended rules are on");
                  } catch (err) {
                    toast.error(err instanceof ApiError ? err.message : "Could not save rules");
                  }
                }}
              />
            ) : (
              <>
                {snapshot && !loading ? <DisciplineFocusCard snapshot={snapshot} /> : null}
                <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
                  <DailyChecklist
                    title={`Daily checklist, ${formatShort(focusDate)}`}
                    day={data?.checklist}
                    today={data?.today}
                    loading={loading}
                    togglingId={togglingId}
                    starting={startDay.isPending}
                    onStartDay={viewingToday && canStartToday ? handleStartToday : undefined}
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
                    onSelectDate={selectDate}
                  />
                </div>
                <CurrentRulesTable
                  rows={data?.rules ?? []}
                  loading={loading}
                  weakestKey={snapshot?.weakest?.rule_key}
                  onEdit={() => setEditOpen(true)}
                />
              </>
            )}
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
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
