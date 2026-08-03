import clsx from "clsx";

import { CalendarDay } from "@/lib/types";

function intensity(pnl: number, maxAbs: number) {
  if (pnl === 0 || maxAbs === 0) return 0;
  return Math.min(1, Math.abs(pnl) / maxAbs);
}

export function YearHeatmap({ year, days }: { year: number; days: CalendarDay[] }) {
  const dayMap = new Map(days.map((d) => [d.date, d]));
  const maxAbs = Math.max(1, ...days.map((d) => Math.abs(d.pnl)));

  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  const weeks: Date[][] = [];
  let current = new Date(start);
  current.setDate(current.getDate() - current.getDay());

  while (current <= end) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((date, di) => {
              if (date.getFullYear() !== year) return <div key={di} className="h-3 w-3" />;
              const iso = date.toISOString().slice(0, 10);
              const cell = dayMap.get(iso);
              const pnl = cell?.pnl ?? 0;
              const level = intensity(pnl, maxAbs);
              return (
                <div
                  key={di}
                  title={`${iso}: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(0)}`}
                  className={clsx("h-3 w-3 rounded-sm", pnl === 0 ? "bg-surface-2" : pnl > 0 ? "bg-positive" : "bg-negative")}
                  style={{ opacity: pnl === 0 ? 1 : 0.25 + level * 0.75 }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
