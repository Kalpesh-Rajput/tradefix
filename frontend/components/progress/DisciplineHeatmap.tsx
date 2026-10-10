"use client";

import clsx from "clsx";
import { useMemo, useState } from "react";

import { InfoTooltip } from "@/components/ui/InfoTooltip";
import {
  DISCIPLINE_LEVELS,
  buildHeatmapWeeks,
  disciplineLevel,
  heatmapCaption,
  isoDay,
} from "@/lib/progress-tracker/discipline";
import type { HeatmapCell } from "@/lib/progress-tracker/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
  const { weeks, monthLabels } = useMemo(() => buildHeatmapWeeks(cells), [cells]);
  const selected = cells.find((cell) => isoDay(cell.date) === selectedDate);

  return (
    <section className="dash-card flex h-full min-h-[220px] flex-col p-4">
      <div className="mb-3 flex h-11 shrink-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Discipline</h2>
          <InfoTooltip
            content="Each square is a day in the selected range. Darker purple means you followed more of the rules that applied. Click a day to load its checklist."
            label="Discipline"
          />
          {selected && selected.score != null ? (
            <span className="ml-1 truncate text-[11px] text-[var(--color-text-muted)]">
              {isoDay(selected.date)} · {Math.round(selected.score)}%
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
          <span>Less</span>
          {DISCIPLINE_LEVELS.map((color) => (
            <span key={color} className="h-2.5 w-2.5 rounded-[2px] border border-black/5" style={{ background: color }} />
          ))}
          <span>More</span>
        </div>
      </div>
      {loading ? (
        <div className="h-[140px] animate-pulse rounded-md bg-[var(--color-primary-very-light)]" />
      ) : weeks.length === 0 ? (
        <p className="text-[12px] text-[var(--color-text-muted)]">No days in this range.</p>
      ) : (
        <div className="min-h-0 min-w-0 flex-1 overflow-x-auto">
          <div className="min-w-max">
            <div
              className="mb-1 grid gap-[3px] pl-8 text-[9px] text-[var(--color-text-muted)]"
              style={{ gridTemplateColumns: `repeat(${weeks.length}, 14px)` }}
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
            <div className="flex gap-[3px]">
              <div className="flex w-7 shrink-0 flex-col justify-between py-0.5 text-[9px] text-[var(--color-text-muted)]">
                {DAYS.map((day, i) => (
                  <span key={day} className={i % 2 === 1 ? "invisible" : ""}>
                    {day}
                  </span>
                ))}
              </div>
              <div className="flex gap-[3px]">
                {weeks.map((col, wi) => (
                  <div key={wi} className="flex flex-col gap-[3px]">
                    {col.map((cell, di) => {
                      if (!cell) return <div key={`${wi}-${di}`} className="h-3.5 w-3.5 rounded-[2px] bg-transparent" />;
                      const level = disciplineLevel(cell);
                      const selectedCell = selectedDate === isoDay(cell.date);
                      const caption = heatmapCaption(cell);
                      return (
                        <button
                          key={cell.date}
                          type="button"
                          title={caption}
                          aria-label={caption}
                          aria-pressed={selectedCell}
                          onMouseEnter={() => setHover(cell)}
                          onMouseLeave={() => setHover((current) => (current?.date === cell.date ? null : current))}
                          onFocus={() => setHover(cell)}
                          onClick={() => onSelectDate?.(isoDay(cell.date))}
                          className={clsx(
                            "h-3.5 w-3.5 rounded-[2px] border border-black/5",
                            selectedCell && "ring-2 ring-primary ring-offset-1 ring-offset-[var(--color-surface)]"
                          )}
                          style={{
                            background:
                              level < 0
                                ? "color-mix(in srgb, var(--color-text-muted) 16%, transparent)"
                                : DISCIPLINE_LEVELS[level],
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-2 min-h-[16px] text-[11px] text-[var(--color-text-muted)]">
              {hover ? heatmapCaption(hover) : "Hover a day for the score. Click it to open that day’s checklist."}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
