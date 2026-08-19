"use client";

import clsx from "clsx";
import { BookOpen, RefreshCw, Sun } from "lucide-react";

import type { CalendarDay } from "@/lib/types";

export type DayMarks = {
  mood?: boolean;
  journaled?: boolean;
  routines?: boolean;
};

function fmtCellPnl(n: number): string {
  if (n === 0) return "$0";
  const sign = n > 0 ? "+" : "-";
  const abs = Math.abs(n);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return `${sign}$${abs.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function MonthGrid({
  year,
  month,
  days,
  marks,
  selectedDate,
  onSelectDate,
}: {
  year: number;
  month: number;
  days: CalendarDay[];
  marks?: Map<string, DayMarks>;
  selectedDate?: string | null;
  onSelectDate?: (iso: string) => void;
}) {
  const dayMap = new Map(days.map((d) => [d.date, d]));
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayIso = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  })();

  const cells: ({ iso: string; inMonth: boolean } | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ iso, inMonth: true });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      <div className="mb-2 grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {cells.map((cell, idx) => {
          if (!cell) return <div key={`empty-${idx}`} className="min-h-[88px]" />;
          const stats = dayMap.get(cell.iso);
          const mark = marks?.get(cell.iso);
          const hasTrades = (stats?.trades ?? 0) > 0;
          const pnl = stats?.pnl ?? 0;
          const isToday = cell.iso === todayIso;
          const isSelected = cell.iso === selectedDate;

          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => onSelectDate?.(cell.iso)}
              className={clsx(
                "flex min-h-[88px] flex-col rounded-lg border p-2 text-left transition-colors duration-150",
                hasTrades
                  ? pnl >= 0
                    ? "border-primary/25 bg-primary/10"
                    : "border-[var(--color-danger-light)] bg-[var(--color-danger-bg)]"
                  : "border-[var(--color-border)] bg-white hover:bg-[var(--color-primary-very-light)]",
                isToday && "ring-1 ring-primary/40",
                isSelected && "ring-2 ring-primary/50"
              )}
            >
              <div className="flex items-start justify-between gap-1">
                <span
                  className={clsx(
                    "text-xs font-semibold",
                    isToday ? "text-primary" : "text-[var(--color-text-primary)]"
                  )}
                >
                  {Number(cell.iso.split("-")[2])}
                </span>
                <DayIcons mark={mark} />
              </div>
              {hasTrades ? (
                <div className="mt-auto pt-2">
                  <div
                    className={clsx(
                      "font-mono text-xs font-semibold",
                      pnl >= 0 ? "text-positive" : "text-negative"
                    )}
                  >
                    {fmtCellPnl(pnl)}
                  </div>
                  <div className="mt-0.5 text-[10px] font-medium text-[var(--color-text-secondary)]">
                    {stats!.trades} trade{stats!.trades === 1 ? "" : "s"}
                  </div>
                </div>
              ) : (
                <div className="mt-auto" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DayIcons({ mark }: { mark?: DayMarks }) {
  if (!mark?.mood && !mark?.journaled && !mark?.routines) return null;
  return (
    <div className="flex items-center gap-0.5">
      {mark.mood && <Sun className="h-3 w-3 text-amber-600" aria-label="Mood" />}
      {mark.journaled && <BookOpen className="h-3 w-3 text-sky-600" aria-label="Journaled" />}
      {mark.routines && <RefreshCw className="h-3 w-3 text-violet-600" aria-label="Routines" />}
    </div>
  );
}
