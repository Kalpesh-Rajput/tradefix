import clsx from "clsx";

import { CalendarDay } from "@/lib/types";

function fmtMoney(n: number) {
  if (n === 0) return "$0";
  const sign = n >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function MonthGrid({ year, month, days }: { year: number; month: number; days: CalendarDay[] }) {
  const dayMap = new Map(days.map((d) => [d.date, d]));
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (CalendarDay | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push(dayMap.get(iso) ?? { date: iso, trades: 0, pnl: 0, win_rate: 0 });
  }

  return (
    <div>
      <div className="grid grid-cols-7 gap-2 text-center text-xs text-gray-500">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-2">
        {cells.map((cell, idx) =>
          cell === null ? (
            <div key={idx} />
          ) : (
            <div
              key={cell.date}
              className={clsx(
                "flex h-20 flex-col justify-between rounded-lg border p-2 text-xs",
                cell.trades === 0
                  ? "border-border bg-surface-2/40 text-gray-600"
                  : cell.pnl >= 0
                  ? "border-positive/30 bg-positive/10 text-positive"
                  : "border-negative/30 bg-negative/10 text-negative"
              )}
            >
              <span className="text-gray-400">{Number(cell.date.split("-")[2])}</span>
              {cell.trades > 0 && (
                <div>
                  <div className="font-semibold">{fmtMoney(cell.pnl)}</div>
                  <div className="text-[10px] text-gray-400">{cell.trades} trades</div>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
