"use client";

import clsx from "clsx";
import { useMemo, useState } from "react";

import type { HeatmapCell } from "@/lib/progress-tracker/types";
import { parseLocalIso, shortMonth } from "@/lib/dateLocal";

const LEVELS = ["#EEF1F6", "#D5DEF4", "#A9BBE6", "#6F8AD0", "#3B4F9C"] as const;

function levelFor(cell: HeatmapCell): number {
  if (cell.future || !cell.tracking || !cell.is_trading_day || cell.score == null) return -1;
  if (cell.total_applicable <= 0) return -1;
  const score = cell.score;
  if (score <= 0) return 0;
  if (score <= 20) return 1;
  if (score <= 40) return 2;
  if (score <= 60) return 3;
  return 4;
}

function weekStartSunday(iso: string) {
  const d = parseLocalIso(iso);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function DisciplineHeatmap({
  cells,
  loading,
  onSelectDate,
  selectedDate,
}: {
  cells: HeatmapCell[];
  loading?: boolean;
  onSelectDate?: (date: string) => void;
  selectedDate?: string | null;
}) {
  const [hover, setHover] = useState<HeatmapCell | null>(null);

  const { weeks, monthLabels } = useMemo(() => {
    if (!cells.length) return { weeks: [] as (HeatmapCell | null)[][], monthLabels: [] as { col: number; label: string }[] };
    const map = new Map(cells.map((c) => [c.date.slice(0, 10), c]));
    const first = cells[0].date.slice(0, 10);
    const last = cells[cells.length - 1].date.slice(0, 10);
    const cursor = weekStartSunday(first);
    const end = parseLocalIso(last);
    const weeks: (HeatmapCell | null)[][] = [];
    const monthLabels: { col: number; label: string }[] = [];
    let lastMonth = -1;
    while (cursor <= end || weeks.length === 0) {
      const col: (HeatmapCell | null)[] = [];
      for (let i = 0; i < 7; i++) {
        const y = cursor.getFullYear();
        const m = String(cursor.getMonth() + 1).padStart(2, "0");
        const d = String(cursor.getDate()).padStart(2, "0");
        const iso = `${y}-${m}-${d}`;
        col.push(map.get(iso) ?? null);
        if (i === 0 && cursor.getMonth() !== lastMonth) {
          monthLabels.push({ col: weeks.length, label: shortMonth(cursor) });
          lastMonth = cursor.getMonth();
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(col);
      if (weeks.length > 60) break;
    }
    return { weeks, monthLabels };
  }, [cells]);

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <section className="dash-card flex h-full min-h-[220px] flex-col p-4">
      <div className="mb-3 flex h-11 shrink-0 items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Progress tracker</h2>
        <div className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
          <span>Less</span>
          {LEVELS.map((c) => (
            <span key={c} className="h-2.5 w-2.5 rounded-[2px] border border-black/5" style={{ background: c }} />
          ))}
          <span>More</span>
        </div>
      </div>
      {loading ? (
        <div className="h-[140px] animate-pulse rounded-md bg-[var(--color-primary-very-light)]" />
      ) : (
        <div className="min-h-0 min-w-0 flex-1 overflow-x-auto">
          <div className="min-w-[420px]">
            <div
              className="mb-1 grid gap-1 pl-7 text-[9px] text-[var(--color-text-muted)]"
              style={{ gridTemplateColumns: `repeat(${weeks.length}, 12px)` }}
            >
              {weeks.map((_, i) => {
                const label = monthLabels.find((m) => m.col === i);
                return (
                  <span key={i} className="h-3 overflow-visible whitespace-nowrap">
                    {label?.label ?? ""}
                  </span>
                );
              })}
            </div>
            <div className="flex gap-1">
              <div className="flex w-6 shrink-0 flex-col justify-between py-0.5 text-[8px] text-[var(--color-text-muted)]">
                {days.map((d, i) => (
                  <span key={d} className={i % 2 === 1 ? "invisible" : ""}>
                    {d.slice(0, 3)}
                  </span>
                ))}
              </div>
              <div className="flex gap-1">
                {weeks.map((col, wi) => (
                  <div key={wi} className="flex flex-col gap-1">
                    {col.map((cell, di) => {
                      if (!cell) return <div key={`${wi}-${di}`} className="h-3 w-3 rounded-[2px] bg-transparent" />;
                      const lv = levelFor(cell);
                      const selected = selectedDate === cell.date;
                      const title = cell.future
                        ? `${cell.date} · upcoming`
                        : !cell.tracking
                          ? `${cell.date} · no tracking yet`
                          : !cell.is_trading_day
                            ? `${cell.date} · not a trading day`
                            : cell.score == null
                              ? `${cell.date} · no applicable rules`
                              : `${cell.date}\n${cell.passed} / ${cell.total_applicable} rules followed\n${Math.round(cell.score)}%`;
                      return (
                        <button
                          key={cell.date}
                          type="button"
                          title={title}
                          aria-label={title.replaceAll("\n", ", ")}
                          onMouseEnter={() => setHover(cell)}
                          onMouseLeave={() => setHover((h) => (h?.date === cell.date ? null : h))}
                          onFocus={() => setHover(cell)}
                          onClick={() => onSelectDate?.(cell.date)}
                          className={clsx(
                            "h-3 w-3 rounded-[2px] border border-black/5",
                            selected && "ring-2 ring-[#F59E0B] ring-offset-1"
                          )}
                          style={{
                            background: lv < 0 ? "color-mix(in srgb, var(--color-text-muted) 14%, transparent)" : LEVELS[lv],
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-2 min-h-[16px] text-[11px] text-[var(--color-text-muted)]">
              {hover
                ? hover.future
                  ? `${hover.date} is upcoming`
                  : !hover.tracking
                    ? `${hover.date} has no Progress Tracker history`
                    : !hover.is_trading_day
                      ? `${hover.date} is outside your trading days`
                      : hover.score == null
                        ? `${hover.date} · no applicable rules`
                        : `${hover.date} · ${hover.passed} / ${hover.total_applicable} rules followed · ${Math.round(hover.score)}%`
                : "Hover a day for the score. Click to load that day’s checklist."}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
