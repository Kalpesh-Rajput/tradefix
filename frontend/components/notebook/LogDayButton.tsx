"use client";

import { FilePlus2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { DayViewCalendar } from "@/components/dayview/DayViewCalendar";
import { localIso, parseLocalIso } from "@/lib/dateLocal";
import { useCalendar } from "@/lib/hooks/useAnalytics";

export function LogDayButton({
  accountId,
  onSelect,
}: {
  accountId?: string;
  onSelect: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => localIso(new Date()));
  const rootRef = useRef<HTMLDivElement>(null);

  const bounds = useMemo(() => {
    const cursor = parseLocalIso(month);
    return {
      start: localIso(new Date(cursor.getFullYear(), cursor.getMonth(), 1)),
      end: localIso(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)),
    };
  }, [month]);

  const { data: calendar } = useCalendar(bounds.start, bounds.end, accountId, {
    enabled: open && !!accountId,
  });

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-primary hover:bg-[var(--color-primary-very-light)]"
        aria-expanded={open}
      >
        <FilePlus2 className="h-3.5 w-3.5" strokeWidth={1.75} />
        Log day
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-40 mt-1 w-[292px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-dropdown)]">
          <DayViewCalendar
            variant="picker"
            days={calendar?.days ?? []}
            month={month}
            selectedDate={null}
            onMonthChange={(start) => setMonth(start)}
            onSelectDate={(date) => {
              onSelect(date);
              setOpen(false);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
