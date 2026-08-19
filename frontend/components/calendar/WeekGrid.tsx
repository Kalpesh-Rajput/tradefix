"use client";

import clsx from "clsx";
import { BookOpen, Sun } from "lucide-react";

import { addDays, localIso, shortMonth } from "@/lib/dateLocal";
import type { CalendarDay } from "@/lib/types";

import type { DayMarks } from "./MonthGrid";

function fmtPnl(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function WeekGrid({
  weekStart,
  days,
  marks,
  selectedDate,
  onSelectDate,
}: {
  weekStart: Date;
  days: CalendarDay[];
  marks?: Map<string, DayMarks>;
  selectedDate?: string | null;
  onSelectDate?: (iso: string) => void;
}) {
  const dayMap = new Map(days.map((d) => [d.date, d]));
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const todayIso = localIso(new Date());

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
      {labels.map((label, i) => {
        const date = addDays(weekStart, i);
        const iso = localIso(date);
        const stats = dayMap.get(iso);
        const mark = marks?.get(iso);
        const hasTrades = (stats?.trades ?? 0) > 0;
        const pnl = stats?.pnl ?? 0;
        const isToday = iso === todayIso;
        const isSelected = iso === selectedDate;

        return (
          <button
            key={iso}
            type="button"
            onClick={() => onSelectDate?.(iso)}
            className={clsx(
              "flex min-h-[140px] flex-col rounded-lg border p-3 text-left transition-colors duration-150",
              hasTrades
                ? pnl >= 0
                  ? "border-primary/25 bg-primary/10"
                  : "border-[var(--color-danger-light)] bg-[var(--color-danger-bg)]"
                : "border-[var(--color-border)] bg-white hover:bg-[var(--color-primary-very-light)]",
              isToday && "ring-1 ring-primary/40",
              isSelected && "ring-2 ring-primary/50"
            )}
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              {label}
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span
                className={clsx(
                  "text-lg font-semibold",
                  isToday ? "text-primary" : "text-[var(--color-text-primary)]"
                )}
              >
                {date.getDate()}
              </span>
              <span className="text-[10px] font-medium text-[var(--color-text-tertiary)]">
                {shortMonth(date)}
              </span>
            </div>
            <div className="mt-2 flex gap-1">
              {mark?.mood && <Sun className="h-3.5 w-3.5 text-amber-600" />}
              {mark?.journaled && <BookOpen className="h-3.5 w-3.5 text-sky-600" />}
            </div>
            <div className="mt-auto pt-3">
              {hasTrades ? (
                <>
                  <div
                    className={clsx(
                      "font-mono text-sm font-semibold",
                      pnl >= 0 ? "text-positive" : "text-negative"
                    )}
                  >
                    {fmtPnl(pnl)}
                  </div>
                  <div className="mt-0.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
                    {stats!.trades} trade{stats!.trades === 1 ? "" : "s"} · {stats!.win_rate}% WR
                  </div>
                </>
              ) : (
                <div className="text-[11px] text-[var(--color-text-tertiary)]">No trades</div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
