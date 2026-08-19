"use client";

import clsx from "clsx";

import { localIso } from "@/lib/dateLocal";
import type { CalendarDay } from "@/lib/types";

function intensity(pnl: number, maxAbs: number) {
  if (pnl === 0 || maxAbs === 0) return 0;
  return Math.min(1, Math.abs(pnl) / maxAbs);
}

export function YearHeatmap({
  year,
  days,
  onSelectMonth,
}: {
  year: number;
  days: CalendarDay[];
  onSelectMonth?: (monthIndex: number) => void;
}) {
  const dayMap = new Map(days.map((d) => [d.date, d]));
  const maxAbs = Math.max(1, ...days.map((d) => Math.abs(d.pnl)));

  const months = Array.from({ length: 12 }, (_, month) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startWeekday = new Date(year, month, 1).getDay();
    const cells: (string | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
    const monthDays = days.filter((d) =>
      d.date.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)
    );
    const monthPnl = monthDays.reduce((s, d) => s + d.pnl, 0);
    return { month, cells, monthPnl, trades: monthDays.reduce((s, d) => s + d.trades, 0) };
  });

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const todayIso = localIso(new Date());

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {months.map(({ month, cells, monthPnl, trades }) => (
        <button
          key={month}
          type="button"
          onClick={() => onSelectMonth?.(month)}
          className="rounded-lg border border-[var(--color-border)] bg-white p-3 text-left transition-colors duration-150 hover:border-primary/30 hover:bg-[var(--color-primary-very-light)]"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-text-primary)]">
              {monthNames[month]}
            </span>
            <span
              className={clsx(
                "font-mono text-[11px] font-semibold",
                trades === 0
                  ? "text-[var(--color-text-tertiary)]"
                  : monthPnl >= 0
                    ? "text-positive"
                    : "text-negative"
              )}
            >
              {trades === 0
                ? "—"
                : `${monthPnl >= 0 ? "+" : "-"}$${Math.abs(monthPnl).toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}`}
            </span>
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((iso, i) => {
              if (!iso) return <div key={`e-${i}`} className="h-2.5 w-full" />;
              const cell = dayMap.get(iso);
              const pnl = cell?.pnl ?? 0;
              const level = intensity(pnl, maxAbs);
              const traded = (cell?.trades ?? 0) > 0;
              return (
                <div
                  key={iso}
                  title={
                    traded
                      ? `${iso}: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(0)} (${cell!.trades} trades)`
                      : iso
                  }
                  className={clsx(
                    "h-2.5 w-full rounded-[2px]",
                    !traded
                      ? iso === todayIso
                        ? "bg-primary/30"
                        : "bg-[#E8E8EC]"
                      : pnl >= 0
                        ? "bg-primary"
                        : "bg-[var(--color-danger)]"
                  )}
                  style={traded ? { opacity: 0.35 + level * 0.65 } : undefined}
                />
              );
            })}
          </div>
        </button>
      ))}
    </div>
  );
}
