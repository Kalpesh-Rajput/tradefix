"use client";

import clsx from "clsx";
import Link from "next/link";
import { useMemo } from "react";

import { ChartCard } from "@/components/dashboard/zella/ChartCard";
import { useLocale } from "@/components/providers/LocaleProvider";
import {
  DISCIPLINE_LEVELS,
  buildHeatmapWeeks,
  disciplineLevel,
  heatmapCaption,
  isoDay,
  rollingDisciplineWindow,
  rulesAreActive,
} from "@/lib/progress-tracker/discipline";
import { useProgressSummary } from "@/lib/hooks/useProgressTracker";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ProgressTracker({
  accountId,
  enabled = true,
}: {
  accountId?: string | null;
  enabled?: boolean;
}) {
  const { t } = useLocale();
  const range = useMemo(() => rollingDisciplineWindow(20), []);
  const summary = useProgressSummary(range.from, range.to, {
    accountId,
    enabled,
  });
  const data = summary.data;
  const active = rulesAreActive(data?.settings);
  const { weeks, monthLabels } = useMemo(() => buildHeatmapWeeks(data?.heatmap ?? []), [data?.heatmap]);
  const today = data ? isoDay(data.today) : "";
  const next =
    data && isoDay(data.focus_date) === today
      ? data.checklist.rules.find((rule) => rule.status === "pending")
      : undefined;
  const passed = data?.today_passed ?? 0;
  const total = data?.today_total ?? 0;
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0;

  return (
    <ChartCard
      title={t("dashboard.progressTracker")}
      hint={t("dashboard.hint.progressTracker")}
      headerRight={
        <Link href="/progress-tracker" className="text-[11px] font-medium text-primary hover:underline">
          View more
        </Link>
      }
    >
      {summary.isLoading || !enabled ? (
        <div className="min-h-0 flex-1 animate-pulse rounded-md bg-[var(--color-primary-very-light)]" />
      ) : summary.isError ? (
        <div className="flex min-h-0 flex-1 flex-col items-start justify-center gap-2">
          <p className="text-[12px] text-[var(--color-text-secondary)]">Couldn’t load your discipline score.</p>
          <button type="button" className="text-[12px] font-medium text-primary" onClick={() => void summary.refetch()}>
            Retry
          </button>
        </div>
      ) : !active ? (
        <div className="flex min-h-0 flex-1 flex-col justify-center">
          <p className="text-[13px] font-medium text-[var(--color-text-primary)]">No rules are on yet</p>
          <p className="mt-1 max-w-sm text-[12px] leading-5 text-[var(--color-text-muted)]">
            This heatmap scores whether you followed your process. Turn on trading hours, a stop, or a daily habit to fill it in.
          </p>
          <Link href="/progress-tracker" className="dash-btn-primary mt-3 w-fit">
            Set up rules
          </Link>
        </div>
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div
            className="mb-1 grid gap-0.5 pl-7 text-[9px] text-[var(--color-text-muted)]"
            style={{ gridTemplateColumns: `repeat(${Math.max(weeks.length, 1)}, minmax(0, 1fr))` }}
          >
            {weeks.map((_, i) => {
              const label = monthLabels.find((month) => month.col === i);
              return (
                <span key={i} className="h-3 overflow-visible whitespace-nowrap">
                  {label?.label ?? ""}
                </span>
              );
            })}
          </div>
          <div className="flex min-h-0 flex-1 gap-0.5">
            <div className="flex w-6 shrink-0 flex-col justify-between py-px text-[8px] leading-none text-[var(--color-text-muted)]">
              {DAYS.map((day, i) => (
                <span key={day} className={i % 2 === 1 ? "invisible" : ""}>
                  {day.slice(0, 3)}
                </span>
              ))}
            </div>
            <div
              className="grid min-h-0 min-w-0 flex-1 gap-0.5"
              style={{ gridTemplateColumns: `repeat(${Math.max(weeks.length, 1)}, minmax(0, 1fr))` }}
            >
              {weeks.map((col, wi) => (
                <div key={wi} className="flex min-h-0 min-w-0 flex-col gap-0.5">
                  {col.map((cell, di) => {
                    if (!cell) return <div key={`${wi}-${di}`} className="min-h-[10px] flex-1" />;
                    const level = disciplineLevel(cell);
                    const caption = heatmapCaption(cell);
                    const background =
                      level < 0 ? "color-mix(in srgb, var(--color-text-muted) 16%, transparent)" : DISCIPLINE_LEVELS[level];
                    if (cell.future) {
                      return (
                        <div
                          key={cell.date}
                          title={caption}
                          className="min-h-[10px] max-h-[18px] w-full flex-1 rounded-[2px]"
                          style={{ background }}
                        />
                      );
                    }
                    return (
                      <Link
                        key={cell.date}
                        href={`/progress-tracker?date=${isoDay(cell.date)}`}
                        title={caption}
                        aria-label={caption}
                        className="min-h-[10px] max-h-[18px] w-full flex-1 rounded-[2px]"
                        style={{ background }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-1.5 flex items-center justify-end gap-1 text-[9px] text-[var(--color-text-muted)]">
            <span>Less</span>
            {DISCIPLINE_LEVELS.map((color) => (
              <span key={color} className="h-2.5 w-2.5 rounded-[2px]" style={{ background: color }} />
            ))}
            <span>More</span>
          </div>
          <div className="mt-1.5 flex shrink-0 items-center gap-3 border-t border-[var(--color-border)] pt-1.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] leading-none text-[var(--color-text-secondary)]">
                Today{" "}
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {passed}/{total}
                </span>
                {next ? <span className="text-[var(--color-text-muted)]"> · {next.name}</span> : null}
              </p>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--color-gauge-track)]">
                <div className={clsx("h-full rounded-full bg-primary")} style={{ width: `${pct}%` }} />
              </div>
            </div>
            <Link href="/progress-tracker" className="dash-btn-secondary h-7 shrink-0 px-2.5 text-[11px]">
              Daily checklist
            </Link>
          </div>
        </div>
      )}
    </ChartCard>
  );
}
