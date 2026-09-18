"use client";

import clsx from "clsx";
import { BookOpen, ChevronLeft, ChevronRight, RefreshCw, Sun, Target } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode, type Ref } from "react";

import { localIso, monthLabel, parseLocalIso } from "@/lib/dateLocal";
import type { CalendarDay } from "@/lib/types";

export type CalendarDayMarks = {
  mood?: boolean;
  journaled?: boolean;
  routines?: boolean;
};

export type PnlHeatmapDay = {
  date: string;
  pnl: number;
  trades: number;
  winRate: number;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const PROFIT = {
  1: { bg: "#F3FAF5", border: "#D7EDE0", text: "#1F7A4D" },
  2: { bg: "#E5F5EB", border: "#C3E4D0", text: "#176B42" },
  3: { bg: "#D4EEDC", border: "#A9D8B8", text: "#145C38" },
} as const;

const LOSS = {
  1: { bg: "#FDF4F4", border: "#F3D4D6", text: "#C23B3B" },
  2: { bg: "#F8E4E6", border: "#EBB8BC", text: "#B13232" },
  3: { bg: "#F3D4D7", border: "#E09AA0", text: "#9B2C2C" },
} as const;

type Cell = {
  key: string;
  iso: string | null;
  day: number;
  inMonth: boolean;
  data?: PnlHeatmapDay;
};

function toHeatmapDays(days: Array<PnlHeatmapDay | CalendarDay>): PnlHeatmapDay[] {
  return days.map((d) => ({
    date: d.date.slice(0, 10),
    pnl: d.pnl,
    trades: d.trades,
    winRate: "winRate" in d ? d.winRate : d.win_rate,
  }));
}

function compactPnl(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1000) {
    const k = abs / 1000;
    const digits = k >= 10 ? 1 : 2;
    return `${sign}$${k.toFixed(digits).replace(/\.0+$/, "")}K`;
  }
  if (abs >= 100) return `${sign}$${Math.round(abs)}`;
  if (Math.abs(abs - Math.round(abs)) < 0.05) return `${sign}$${Math.round(abs)}`;
  return `${sign}$${abs.toFixed(1)}`;
}

function intensity(absPnl: number, peak: number): 1 | 2 | 3 {
  if (peak <= 0) return 1;
  const t = absPnl / peak;
  if (t >= 0.66) return 3;
  if (t >= 0.28) return 2;
  return 1;
}

function toneFor(pnl: number, peak: number) {
  const level = intensity(Math.abs(pnl), peak);
  return pnl >= 0 ? PROFIT[level] : LOSS[level];
}

export function PnlCalendarHeatmap({
  days,
  month,
  className,
  size = "compact",
  selectedDate,
  marks,
  headerActions,
  captureRef,
  monthlyGoal,
  dailyGoal,
  onMonthChange,
  onSelectDate,
  onOpenDate,
}: {
  days: Array<PnlHeatmapDay | CalendarDay>;
  month?: string | null;
  className?: string;
  size?: "compact" | "page";
  selectedDate?: string | null;
  marks?: Map<string, CalendarDayMarks>;
  headerActions?: ReactNode;
  captureRef?: Ref<HTMLDivElement>;
  monthlyGoal?: number | null;
  dailyGoal?: number | null;
  onMonthChange?: (start: string, end: string) => void;
  onSelectDate?: (date: string) => void;
  onOpenDate?: (date: string) => void;
}) {
  const [cursor, setCursor] = useState(() => {
    if (month) {
      const parsed = parseLocalIso(month.slice(0, 10));
      if (!Number.isNaN(parsed.getTime())) return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!month) return;
    const parsed = parseLocalIso(month.slice(0, 10));
    if (Number.isNaN(parsed.getTime())) return;
    const next = new Date(parsed.getFullYear(), parsed.getMonth(), 1);
    setCursor((prev) =>
      prev.getFullYear() === next.getFullYear() && prev.getMonth() === next.getMonth() ? prev : next
    );
  }, [month]);

  const mapped = useMemo(() => toHeatmapDays(days), [days]);
  const dayMap = useMemo(() => {
    const map = new Map<string, PnlHeatmapDay>();
    for (const d of mapped) map.set(d.date, d);
    return map;
  }, [mapped]);

  const year = cursor.getFullYear();
  const monthIndex = cursor.getMonth();
  const todayKey = localIso(new Date());

  const cells = useMemo<Cell[]>(() => {
    const first = new Date(year, monthIndex, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const out: Cell[] = [];
    for (let i = 0; i < startPad; i++) {
      out.push({ key: `lead-${i}`, iso: null, day: 0, inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = localIso(new Date(year, monthIndex, d));
      out.push({ key: iso, iso, day: d, inMonth: true, data: dayMap.get(iso) });
    }
    while (out.length < 42) {
      out.push({ key: `trail-${out.length}`, iso: null, day: 0, inMonth: false });
    }
    return out;
  }, [year, monthIndex, dayMap]);

  const peak = useMemo(() => {
    const values = cells.filter((c) => c.data && c.data.trades > 0).map((c) => Math.abs(c.data!.pnl));
    return values.length ? Math.max(...values) : 0;
  }, [cells]);

  const weeks = useMemo(() => {
    return Array.from({ length: 6 }, (_, week) => {
      const slice = cells.slice(week * 7, week * 7 + 7);
      const traded = slice.filter((c) => c.inMonth && (c.data?.trades ?? 0) > 0);
      const pnl = traded.reduce((sum, c) => sum + (c.data?.pnl ?? 0), 0);
      return { week: week + 1, pnl, days: traded.length };
    });
  }, [cells]);

  const monthStats = useMemo(() => {
    const traded = mapped.filter((d) => {
      const dt = parseLocalIso(d.date);
      return dt.getFullYear() === year && dt.getMonth() === monthIndex && d.trades > 0;
    });
    return {
      pnl: traded.reduce((s, d) => s + d.pnl, 0),
      days: traded.length,
    };
  }, [mapped, year, monthIndex]);

  function emitMonth(next: Date) {
    setCursor(next);
    onMonthChange?.(
      localIso(new Date(next.getFullYear(), next.getMonth(), 1)),
      localIso(new Date(next.getFullYear(), next.getMonth() + 1, 0))
    );
  }

  function goThisMonth() {
    const now = new Date();
    emitMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelected(todayKey);
    onSelectDate?.(todayKey);
  }

  const page = size === "page";
  const selectedKey = selectedDate !== undefined ? selectedDate : selected;

  return (
    <div
      ref={captureRef}
      className={clsx("dash-card flex h-full min-h-0 flex-col overflow-hidden", className)}
    >
      <div
        className={clsx(
          "flex shrink-0 items-center justify-between gap-2 overflow-hidden border-b border-[#EEEFF2]",
          page ? "h-12 px-4" : "h-11 px-3"
        )}
      >
        <div className="flex items-center gap-2">
          <h3
            className={clsx(
              "font-semibold tracking-tight text-[#1F2128]",
              page ? "text-[15px]" : "text-[13px]"
            )}
          >
            {monthLabel(cursor)}
          </h3>
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => emitMonth(new Date(year, monthIndex - 1, 1))}
              className="rounded-md p-1 text-[#6B6E78] hover:bg-[#F4F5F7] hover:text-[#1F2128]"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => emitMonth(new Date(year, monthIndex + 1, 1))}
              className="rounded-md p-1 text-[#6B6E78] hover:bg-[#F4F5F7] hover:text-[#1F2128]"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
          <button
            type="button"
            onClick={goThisMonth}
            className="h-7 rounded-md border border-[#E4E5EA] bg-white px-2.5 text-[11px] font-medium text-[#4A4D57] hover:bg-[#F7F8FA]"
          >
            This month
          </button>
        </div>
        <div className="flex shrink-0 flex-nowrap items-center gap-2 text-[11px] text-[#6B6E78]">
          <span>Monthly stats:</span>
          <span
            className={clsx(
              "inline-flex h-6 items-center rounded-full px-2 text-[11px] font-semibold tabular-nums",
              monthStats.pnl > 0
                ? "bg-[#E8F6EE] text-[#1F7A4D]"
                : monthStats.pnl < 0
                  ? "bg-[#FDECEE] text-[#C23B3B]"
                  : "bg-[#F3F4F6] text-[#4A4D57]"
            )}
          >
            {compactPnl(monthStats.pnl)}
          </span>
          <span className="inline-flex h-6 items-center rounded-full bg-[#EEE8F8] px-2 text-[11px] font-semibold text-[#5B4696]">
            {monthStats.days} {monthStats.days === 1 ? "day" : "days"}
          </span>
          {monthlyGoal != null && monthlyGoal > 0 && (
            <span
              className={clsx(
                "inline-flex h-6 items-center rounded-full px-2 text-[11px] font-semibold tabular-nums",
                monthStats.pnl >= monthlyGoal
                  ? "bg-[#E8F6EE] text-[#1F7A4D]"
                  : "bg-[#F4F5F7] text-[#4A4D57]"
              )}
            >
              {Math.max(0, Math.min(100, Math.round((monthStats.pnl / monthlyGoal) * 100)))}% goal
            </span>
          )}
          {headerActions}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto">
        <div
          className={clsx(
            "grid h-full gap-1",
            page
              ? "min-w-[760px] grid-cols-[1fr_96px] p-3"
              : "min-w-[640px] grid-cols-[1fr_72px] p-2"
          )}
        >
          <div className="flex min-h-0 flex-col">
            <div className="mb-1 grid shrink-0 grid-cols-7 gap-1">
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className={clsx(
                    "py-0.5 text-center font-medium text-[#8B8D96]",
                    page ? "text-[12px]" : "text-[10px]"
                  )}
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-1">
              {cells.map((cell) => {
                const traded = Boolean(cell.inMonth && cell.data && cell.data.trades > 0);
                const tone = traded ? toneFor(cell.data!.pnl, peak) : null;
                const isToday = cell.iso === todayKey;
                const isSelected = cell.iso != null && cell.iso === selectedKey;
                const mark = cell.iso ? marks?.get(cell.iso) : undefined;
                const hitDaily =
                  traded && dailyGoal != null && dailyGoal > 0 && cell.data!.pnl >= dailyGoal;

                return (
                  <button
                    key={cell.key}
                    type="button"
                    disabled={!cell.inMonth}
                    onClick={() => {
                      if (!cell.iso) return;
                      setSelected(cell.iso);
                      onSelectDate?.(cell.iso);
                      onOpenDate?.(cell.iso);
                    }}
                    className={clsx(
                      "relative flex h-full min-h-0 flex-col overflow-hidden rounded-md border text-left",
                      page ? "px-1.5 pb-1 pt-1" : "px-1 pb-0.5 pt-0.5",
                      !cell.inMonth && "border-transparent bg-transparent",
                      cell.inMonth && !traded && "border-[#EEEFF2] bg-white",
                      traded && "border",
                      isToday && cell.inMonth && "ring-1 ring-[#C9CBD4]",
                      isSelected && "ring-2 ring-[#5B4696]/25"
                    )}
                    style={
                      tone
                        ? { backgroundColor: tone.bg, borderColor: tone.border }
                        : undefined
                    }
                  >
                    {cell.inMonth && (
                      <>
                        <div className="flex items-start justify-between gap-0.5">
                          <DayMarkIcons mark={mark} />
                          <span
                            className={clsx(
                              "ml-auto font-medium leading-none text-[#8B8D96]",
                              page ? "text-[11px]" : "text-[9px]"
                            )}
                          >
                            {cell.day}
                          </span>
                        </div>
                        {traded ? (
                          <div className="mt-0.5 flex min-h-0 flex-1 flex-col items-center justify-center text-center">
                            <span
                              className={clsx(
                                "font-semibold tabular-nums leading-none",
                                page ? "text-[18px]" : "text-[13px]"
                              )}
                              style={{ color: tone?.text }}
                            >
                              {compactPnl(cell.data!.pnl)}
                            </span>
                            <span
                              className={clsx(
                                "leading-tight text-[#8B8D96]",
                                page ? "mt-1 text-[10px]" : "mt-0.5 text-[8px]"
                              )}
                            >
                              {cell.data!.trades} {cell.data!.trades === 1 ? "trade" : "trades"}
                            </span>
                            <span
                              className={clsx(
                                "leading-tight text-[#8B8D96]",
                                page ? "text-[10px]" : "text-[8px]"
                              )}
                            >
                              {cell.data!.winRate.toFixed(1)}%
                            </span>
                            {hitDaily && (
                              <span className="mt-0.5 inline-flex items-center gap-0.5 text-[8px] font-medium text-[#5B4696]">
                                <Target className="h-2.5 w-2.5" strokeWidth={2} />
                                Goal
                              </span>
                            )}
                          </div>
                        ) : null}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex min-h-0 flex-col">
            <div className="mb-1 h-[22px] shrink-0" />
            <div className="grid min-h-0 flex-1 grid-rows-6 gap-1">
              {weeks.map((week) => (
                <div
                  key={week.week}
                  className="flex h-full min-h-0 flex-col items-center justify-center rounded-md border border-[#EEEFF2] bg-white px-1 py-1"
                >
                  <p className={clsx("font-medium text-[#8B8D96]", page ? "text-[11px]" : "text-[9px]")}>
                    Week {week.week}
                  </p>
                  <p
                    className={clsx(
                      "mt-0.5 font-semibold tabular-nums leading-none",
                      page ? "text-[15px]" : "text-[12px]",
                      week.pnl > 0 && "text-[#1F7A4D]",
                      week.pnl < 0 && "text-[#C23B3B]",
                      week.pnl === 0 && "text-[#4A4D57]"
                    )}
                  >
                    {compactPnl(week.pnl)}
                  </p>
                  <span
                    className={clsx(
                      "mt-1 inline-flex items-center rounded-full bg-[#F3F4F6] text-[#6B6E78]",
                      page ? "h-5 px-2 text-[10px]" : "h-4 px-1.5 text-[8px]"
                    )}
                  >
                    {week.days} {week.days === 1 ? "day" : "days"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DayMarkIcons({ mark }: { mark?: CalendarDayMarks }) {
  if (!mark?.mood && !mark?.journaled && !mark?.routines) return null;
  return (
    <span className="flex items-center gap-0.5">
      {mark.mood && <Sun className="h-3 w-3 text-amber-600" aria-label="Mood" />}
      {mark.journaled && <BookOpen className="h-3 w-3 text-sky-600" aria-label="Journaled" />}
      {mark.routines && <RefreshCw className="h-3 w-3 text-violet-600" aria-label="Routines" />}
    </span>
  );
}
