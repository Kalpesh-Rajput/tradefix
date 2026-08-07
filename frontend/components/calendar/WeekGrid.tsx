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
              "flex min-h-[140px] flex-col rounded-xl border p-3 text-left transition",
              hasTrades
                ? pnl >= 0
                  ? "border-primary/25 bg-primary/5"
                  : "border-destructive/25 bg-destructive/5"
                : "border-white/[0.06] bg-white/[0.02] hover:border-white/10",
              isToday && "ring-1 ring-primary/50",
              isSelected && "ring-1 ring-white/30"
            )}
          >
            <div className="text-[10px] uppercase tracking-wider text-zinc-600">{label}</div>
            <div className="mt-1 flex items-center justify-between">
              <span className={clsx("text-lg font-medium", isToday ? "text-primary" : "text-white")}>
                {date.getDate()}
              </span>
              <span className="text-[10px] text-zinc-600">{shortMonth(date)}</span>
            </div>
            <div className="mt-2 flex gap-1">
              {mark?.mood && <Sun className="h-3.5 w-3.5 text-amber-400/80" />}
              {mark?.journaled && <BookOpen className="h-3.5 w-3.5 text-sky-400/80" />}
            </div>
            <div className="mt-auto pt-3">
              {hasTrades ? (
                <>
                  <div
                    className={clsx(
                      "font-mono text-sm font-semibold",
                      pnl >= 0 ? "text-primary" : "text-destructive"
                    )}
                  >
                    {fmtPnl(pnl)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-500">
                    {stats!.trades} trade{stats!.trades === 1 ? "" : "s"} · {stats!.win_rate}% WR
                  </div>
                </>
              ) : (
                <div className="text-[11px] text-zinc-600">No trades</div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
