"use client";

import { useMemo, useState } from "react";

import { MonthGrid } from "@/components/calendar/MonthGrid";
import { YearHeatmap } from "@/components/calendar/YearHeatmap";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useCalendar } from "@/lib/hooks/useAnalytics";

function fmtMoney(n: number) {
  const sign = n >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export default function CalendarPage() {
  const [view, setView] = useState<"month" | "year">("month");
  const [cursor, setCursor] = useState(() => new Date());

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const range = useMemo(() => {
    if (view === "month") {
      const start = new Date(year, month, 1).toISOString().slice(0, 10);
      const end = new Date(year, month + 1, 0).toISOString().slice(0, 10);
      return { start, end };
    }
    return { start: `${year}-01-01`, end: `${year}-12-31` };
  }, [view, year, month]);

  const { data: calendar, isLoading } = useCalendar(range.start, range.end);

  function shiftMonth(delta: number) {
    setCursor(new Date(year, month + delta, 1));
  }

  function shiftYear(delta: number) {
    setCursor(new Date(year + delta, month, 1));
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Calendar</h1>
          <p className="mt-1 text-sm text-gray-400">Every trading day, color-coded by P&amp;L.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant={view === "month" ? "primary" : "secondary"} onClick={() => setView("month")}>
            Month
          </Button>
          <Button size="sm" variant={view === "year" ? "primary" : "secondary"} onClick={() => setView("year")}>
            Year
          </Button>
        </div>
      </div>

      {calendar && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <p className="text-xs text-gray-400">Total P&amp;L</p>
            <p className={`mt-1 text-xl font-semibold ${calendar.total_pnl >= 0 ? "text-positive" : "text-negative"}`}>
              {fmtMoney(calendar.total_pnl)}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-gray-400">Trades</p>
            <p className="mt-1 text-xl font-semibold text-white">{calendar.total_trades}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-400">Win rate</p>
            <p className="mt-1 text-xl font-semibold text-white">{calendar.win_rate}%</p>
          </Card>
        </div>
      )}

      <Card>
        <div className="mb-4 flex items-center justify-between">
          {view === "month" ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => shiftMonth(-1)}>
                ← Prev
              </Button>
              <h3 className="text-sm font-semibold text-white">
                {cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </h3>
              <Button size="sm" variant="ghost" onClick={() => shiftMonth(1)}>
                Next →
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={() => shiftYear(-1)}>
                ← {year - 1}
              </Button>
              <h3 className="text-sm font-semibold text-white">{year} — Year heatmap</h3>
              <Button size="sm" variant="ghost" onClick={() => shiftYear(1)}>
                {year + 1} →
              </Button>
            </>
          )}
        </div>

        {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
        {!isLoading && calendar && view === "month" && <MonthGrid year={year} month={month} days={calendar.days} />}
        {!isLoading && calendar && view === "year" && <YearHeatmap year={year} days={calendar.days} />}
      </Card>
    </div>
  );
}
