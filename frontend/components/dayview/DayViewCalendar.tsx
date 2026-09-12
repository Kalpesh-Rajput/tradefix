"use client";

import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { localIso, monthLabel, parseLocalIso } from "@/lib/dateLocal";
import type { CalendarDay } from "@/lib/types";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

export function DayViewCalendar({
  days,
  month,
  onMonthChange,
  onSelectDate,
  onRangeChange,
  variant = "dayview",
  selectedDate,
  rangeFrom,
  rangeTo,
  selectMode = "single",
}: {
  days: CalendarDay[];
  month?: string | null;
  onMonthChange?: (start: string, end: string) => void;
  onSelectDate?: (date: string) => void;
  onRangeChange?: (from: string, to: string) => void;
  variant?: "dayview" | "picker";
  selectedDate?: string | null;
  rangeFrom?: string | null;
  rangeTo?: string | null;
  selectMode?: "single" | "range";
}) {
  const [cursor, setCursor] = useState(() => monthDate(month));
  const [selected, setSelected] = useState<string | null>(selectedDate ?? null);
  const [draftFrom, setDraftFrom] = useState<string | null>(rangeFrom ?? null);
  const [draftTo, setDraftTo] = useState<string | null>(rangeTo ?? null);

  useEffect(() => {
    const next = monthDate(month);
    setCursor((prev) =>
      prev.getFullYear() === next.getFullYear() && prev.getMonth() === next.getMonth() ? prev : next
    );
  }, [month]);

  useEffect(() => {
    setDraftFrom(rangeFrom ?? null);
    setDraftTo(rangeTo ?? null);
  }, [rangeFrom, rangeTo]);

  const year = cursor.getFullYear();
  const monthIndex = cursor.getMonth();
  const todayKey = localIso(new Date());
  const from = draftFrom;
  const to = draftTo ?? draftFrom;

  const dayMap = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    for (const d of days) map.set(d.date.slice(0, 10), d);
    return map;
  }, [days]);

  const cells = useMemo(() => {
    const startPad = new Date(year, monthIndex, 1).getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const out: { key: string; day: number; iso: string | null }[] = [];
    for (let i = 0; i < startPad; i++) out.push({ key: `pad-${i}`, day: 0, iso: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = localIso(new Date(year, monthIndex, d));
      out.push({ key: iso, day: d, iso });
    }
    while (out.length % 7 !== 0) out.push({ key: `trail-${out.length}`, day: 0, iso: null });
    return out;
  }, [year, monthIndex]);

  function shift(delta: number) {
    const next = new Date(year, monthIndex + delta, 1);
    setCursor(next);
    onMonthChange?.(
      localIso(new Date(next.getFullYear(), next.getMonth(), 1)),
      localIso(new Date(next.getFullYear(), next.getMonth() + 1, 0))
    );
  }

  function handleSelect(iso: string) {
    if (selectMode === "range") {
      if (!draftFrom || (draftFrom && draftTo)) {
        setDraftFrom(iso);
        setDraftTo(null);
        return;
      }
      const start = draftFrom < iso ? draftFrom : iso;
      const end = draftFrom < iso ? iso : draftFrom;
      setDraftFrom(start);
      setDraftTo(end);
      onRangeChange?.(start, end);
      return;
    }
    setSelected(iso);
    onSelectDate?.(iso);
  }

  return (
    <div
      className={clsx(
        "bg-[var(--color-surface)]",
        variant === "picker"
          ? "p-0"
          : "rounded-xl border border-[var(--color-border)] p-3 shadow-[var(--shadow-sm)]"
      )}
    >
      <div className="mb-2 flex h-7 items-center justify-between">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-[var(--color-text-tertiary)] hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)]"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
        <h3 className="text-[13px] font-semibold text-[var(--color-text-primary)]">{monthLabel(cursor)}</h3>
        <button
          type="button"
          onClick={() => shift(1)}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-[var(--color-text-tertiary)] hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)]"
          aria-label="Next month"
        >
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-medium text-[var(--color-text-muted)]">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((cell) => {
          if (!cell.iso) return <div key={cell.key} className="h-9" />;
          const data = dayMap.get(cell.iso);
          const traded = (data?.trades ?? 0) > 0;
          const pnl = data?.pnl ?? 0;
          const isToday = cell.iso === todayKey;
          const isSelected = selectMode === "single" && cell.iso === (selectedDate ?? selected);
          const inRange = Boolean(from && to && cell.iso >= from && cell.iso <= to);
          const isEdge = cell.iso === from || cell.iso === to;

          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => handleSelect(cell.iso!)}
              className={clsx(
                "flex h-9 items-center justify-center rounded-lg text-[11px] font-medium tabular-nums",
                !traded && "text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-very-light)]",
                traded && pnl > 0 && "bg-[#E8F6EE] text-[#1F7A4D]",
                traded && pnl < 0 && "bg-[#FDECEE] text-[#C23B3B]",
                traded && pnl === 0 && "bg-[#F3F4F6] text-[#4A4B52]",
                isToday && !isSelected && !isEdge && "ring-1 ring-[#C9CBD4]",
                isSelected && "ring-2 ring-primary/45",
                inRange && !traded && "bg-[var(--color-primary-light)] text-primary",
                isEdge && "ring-2 ring-primary/55"
              )}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
      {selectMode === "range" ? (
        <p className="mt-2 text-center text-[10px] text-[var(--color-text-muted)]">
          {from && to && from !== to
            ? `${from} → ${to}`
            : from
              ? "Select an end date"
              : "Select a start date"}
        </p>
      ) : null}
    </div>
  );
}

function monthDate(month?: string | null) {
  if (month) {
    const parsed = parseLocalIso(month.slice(0, 10));
    if (!Number.isNaN(parsed.getTime())) return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
