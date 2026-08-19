"use client";

import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import type { CalendarDay } from "@/lib/types";

function localIso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function compactMoney(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1000) return `${n < 0 ? "-" : ""}$${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}K`;
  return `${n < 0 ? "-" : ""}$${Math.round(abs)}`;
}

export function DashboardCalendar({
  days,
  onMonthChange,
  onSelectDate,
}: {
  days: CalendarDay[];
  onMonthChange?: (start: string, end: string) => void;
  onSelectDate?: (date: string) => void;
}) {
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<string | null>(null);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const dayMap = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    for (const d of days) map.set(d.date.slice(0, 10), d);
    return map;
  }, [days]);

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out: { key: string; day: number; inMonth: boolean; data?: CalendarDay }[] = [];

    for (let i = 0; i < startPad; i++) {
      out.push({ key: `pad-${i}`, day: 0, inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const key = localIso(new Date(year, month, d));
      out.push({ key, day: d, inMonth: true, data: dayMap.get(key) });
    }
    while (out.length % 7 !== 0) {
      out.push({ key: `trail-${out.length}`, day: 0, inMonth: false });
    }
    return out;
  }, [year, month, dayMap]);

  const label = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const todayKey = localIso(new Date());

  function shift(delta: number) {
    const next = new Date(year, month + delta, 1);
    setCursor(next);
    const start = localIso(new Date(next.getFullYear(), next.getMonth(), 1));
    const end = localIso(new Date(next.getFullYear(), next.getMonth() + 1, 0));
    onMonthChange?.(start, end);
  }

  function goToday() {
    const now = new Date();
    setCursor(now);
    const start = localIso(new Date(now.getFullYear(), now.getMonth(), 1));
    const end = localIso(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    onMonthChange?.(start, end);
    setSelected(todayKey);
    onSelectDate?.(todayKey);
  }

  return (
    <div className="dash-card flex flex-col p-3.5">
      <div className="mb-2.5 flex shrink-0 items-center justify-between gap-2">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => shift(-1)}
            className="rounded-md p-1 text-[var(--color-text-secondary)] transition-colors duration-150 hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)]"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)] transition-colors duration-150 hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)]"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            className="rounded-md p-1 text-[var(--color-text-secondary)] transition-colors duration-150 hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)]"
            aria-label="Next month"
          >
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        </div>
        <h3 className="text-[12px] font-medium text-[var(--color-text-primary)]">{label}</h3>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[9px] font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-0.5">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          if (!cell.inMonth) return <div key={cell.key} className="h-[48px]" />;
          const pnl = cell.data?.pnl ?? 0;
          const trades = cell.data?.trades ?? 0;
          const hasTrades = trades > 0;
          const win = pnl > 0;
          const loss = pnl < 0;
          const isSelected = selected === cell.key;
          const isToday = cell.key === todayKey;

          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => {
                setSelected(cell.key);
                onSelectDate?.(cell.key);
              }}
              className={clsx(
                "flex h-[48px] flex-col rounded-md border p-1 text-left transition-colors duration-150",
                hasTrades && win && "border-primary/20 bg-primary/10",
                hasTrades && loss && "border-[#F8DDE0] bg-[var(--color-danger-bg)]",
                hasTrades && !win && !loss && "border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]",
                !hasTrades && "border-[var(--color-border-light)] bg-[var(--color-surface)] hover:bg-[var(--color-primary-very-light)]",
                isToday && "ring-1 ring-primary/35",
                isSelected && "ring-2 ring-primary/40"
              )}
            >
              <span className="text-[9px] font-medium text-[var(--color-text-secondary)]">
                {cell.day}
              </span>
              {hasTrades && (
                <>
                  <span
                    className={clsx(
                      "mt-auto text-[11px] font-semibold tabular-nums leading-tight",
                      win ? "text-positive" : loss ? "text-negative" : "text-[var(--color-text-secondary)]"
                    )}
                  >
                    {compactMoney(pnl)}
                  </span>
                  <span className="text-[9px] font-normal text-[var(--color-text-tertiary)]">
                    {trades} trade{trades === 1 ? "" : "s"}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
