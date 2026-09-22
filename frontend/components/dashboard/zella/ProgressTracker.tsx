"use client";

import clsx from "clsx";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ChartCard } from "@/components/dashboard/zella/ChartCard";
import type { ActivityCell } from "@/lib/dashboardSeries";

const LEVELS = ["#EEF1F6", "#C9D4F0", "#8EA4DE", "#5B7AC8", "#3B4F9C"] as const;

function level(trades: number, peak: number): number {
  if (trades <= 0 || peak <= 0) return 0;
  const t = trades / peak;
  if (t >= 0.8) return 4;
  if (t >= 0.55) return 3;
  if (t >= 0.3) return 2;
  return 1;
}

export function ProgressTracker({
  weeks,
  monthLabels,
}: {
  weeks: ActivityCell[][];
  monthLabels: { col: number; label: string }[];
}) {
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(5);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("tradefix_daily_goals");
      if (!raw) return;
      const goals = JSON.parse(raw) as { done?: boolean }[];
      if (!Array.isArray(goals) || goals.length === 0) return;
      setTotal(goals.length);
      setDone(goals.filter((g) => g.done).length);
    } catch {
      /* ignore */
    }
  }, []);

  const peak = useMemo(
    () => Math.max(1, ...weeks.flat().map((c) => c.trades)),
    [weeks]
  );
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <ChartCard
      title="Progress tracker"
      hint="Squares are trading days. Darker blue means more trades that day."
      headerRight={
        <Link href="/progress-tracker" className="text-[11px] font-medium text-primary hover:underline">
          View more
        </Link>
      }
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          className="mb-1 grid gap-0.5 pl-7 text-[9px] text-[#8B8D96]"
          style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}
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
        <div className="flex min-h-0 flex-1 gap-0.5">
          <div className="flex w-6 shrink-0 flex-col justify-between py-px text-[8px] leading-none text-[#8B8D96]">
            {days.map((d, i) => (
              <span key={d} className={i % 2 === 1 ? "invisible" : ""}>
                {d.slice(0, 3)}
              </span>
            ))}
          </div>
          <div
            className="grid min-h-0 min-w-0 flex-1 gap-0.5"
            style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}
          >
            {weeks.map((col, wi) => (
              <div key={wi} className="flex min-h-0 min-w-0 flex-col gap-0.5">
                {col.map((cell) => {
                  const lv = level(cell.trades, peak);
                  return (
                    <div
                      key={cell.iso}
                      title={`${cell.iso}: ${cell.trades} trades`}
                      className="min-h-[12px] max-h-[18px] w-full flex-1 rounded-[2px]"
                      style={{ background: LEVELS[lv] }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-1.5 flex items-center justify-end gap-1 text-[9px] text-[#8B8D96]">
          <span>Less</span>
          {LEVELS.map((c) => (
            <span key={c} className="h-2.5 w-2.5 rounded-[2px]" style={{ background: c }} />
          ))}
          <span>More</span>
        </div>
      </div>

      <div className="mt-1.5 flex shrink-0 items-center gap-3 border-t border-[#EEEFF2] pt-1.5">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] leading-none text-[#6B6E78]">
            Today&apos;s score{" "}
            <span className="font-semibold text-[#1F2128]">
              {done}/{total}
            </span>
          </p>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-[#EEF1F6]">
            <div className="h-full rounded-full bg-[#5B7AC8]" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <Link
          href="/settings/goals"
          className={clsx(
            "inline-flex h-7 shrink-0 items-center rounded-md border border-[#E4E5EA] bg-white px-2.5",
            "text-[11px] font-medium text-[#4A4D57] hover:bg-[#F7F8FA]"
          )}
        >
          Daily checklist
        </Link>
      </div>
    </ChartCard>
  );
}
