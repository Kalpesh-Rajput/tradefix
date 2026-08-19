"use client";

import clsx from "clsx";
import { BookOpen, ChevronLeft, ChevronRight, RefreshCw, Sun } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { CalendarSidebar } from "@/components/calendar/CalendarSidebar";
import { MonthGrid, type DayMarks } from "@/components/calendar/MonthGrid";
import { WeekGrid } from "@/components/calendar/WeekGrid";
import { YearHeatmap } from "@/components/calendar/YearHeatmap";
import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  addDays,
  localIso,
  monthLabel,
  startOfWeekSunday,
} from "@/lib/dateLocal";
import { useCalendar } from "@/lib/hooks/useAnalytics";
import { useMoodCheckins } from "@/lib/hooks/useMood";
import { useRecaps } from "@/lib/hooks/useRecaps";
import { useTrades } from "@/lib/hooks/useTrades";

type View = "week" | "month" | "year";

export default function CalendarPage() {
  const { activeAccount, loading: accountsLoading } = useAccountPrefs();
  const accountId = activeAccount?.id;

  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const weekStart = useMemo(() => startOfWeekSunday(cursor), [cursor]);

  const range = useMemo(() => {
    if (view === "week") {
      return { start: localIso(weekStart), end: localIso(addDays(weekStart, 6)) };
    }
    if (view === "month") {
      return {
        start: localIso(new Date(year, month, 1)),
        end: localIso(new Date(year, month + 1, 0)),
      };
    }
    return { start: `${year}-01-01`, end: `${year}-12-31` };
  }, [view, year, month, weekStart]);

  const { data: calendar, isLoading, isError, refetch } = useCalendar(
    range.start,
    range.end,
    accountId,
    { enabled: !!accountId }
  );

  const monthRange = useMemo(
    () => ({
      start: localIso(new Date(year, month, 1)),
      end: localIso(new Date(year, month + 1, 0)),
    }),
    [year, month]
  );

  const { data: monthCalendar } = useCalendar(monthRange.start, monthRange.end, accountId, {
    enabled: !!accountId && view !== "month",
  });

  const { data: mood = [] } = useMoodCheckins();
  const { data: recaps = [] } = useRecaps(accountId);
  const { data: trades = [] } = useTrades(
    {
      account_id: accountId,
      date_from: `${range.start}T00:00:00`,
      date_to: `${range.end}T23:59:59`,
      limit: 1000,
    },
    { enabled: !!accountId }
  );

  const marks = useMemo(() => {
    const map = new Map<string, DayMarks>();
    for (const m of mood) {
      const key = m.date.slice(0, 10);
      if (key < range.start || key > range.end) continue;
      const prev = map.get(key) ?? {};
      map.set(key, {
        ...prev,
        mood: true,
        journaled: prev.journaled || Boolean(m.notes?.trim()),
      });
    }
    for (const r of recaps) {
      const key = r.date.slice(0, 10);
      if (key < range.start || key > range.end) continue;
      const prev = map.get(key) ?? {};
      map.set(key, { ...prev, journaled: true, mood: prev.mood || Boolean(r.day_mood) });
    }
    for (const t of trades) {
      const key = (t.closed_at || t.opened_at).slice(0, 10);
      if (key < range.start || key > range.end) continue;
      const hasJournal =
        Boolean(t.notes?.trim()) ||
        (Array.isArray(t.screenshot_urls) && t.screenshot_urls.length > 0) ||
        Boolean(t.plan_compliance) ||
        (Array.isArray(t.emotion_tags) && t.emotion_tags.length > 0);
      if (!hasJournal) continue;
      const prev = map.get(key) ?? {};
      map.set(key, { ...prev, journaled: true });
    }
    return map;
  }, [mood, recaps, trades, range.start, range.end]);

  const stats = useMemo(() => {
    const days = calendar?.days ?? [];
    const tradingDays = days.filter((d) => d.trades > 0);
    const bestDay = tradingDays.length ? Math.max(...tradingDays.map((d) => d.pnl)) : 0;
    const journaled = [...marks.values()].filter((m) => m.mood || m.journaled).length;
    return {
      netPnl: calendar?.total_pnl ?? 0,
      winRate: calendar?.win_rate ?? 0,
      bestDay,
      trades: calendar?.total_trades ?? 0,
      tradingDays: tradingDays.length,
      journaled,
    };
  }, [calendar, marks]);

  const periodLabel = useMemo(() => {
    if (view === "week") {
      const end = addDays(weekStart, 6);
      const a = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const b = end.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return `${a} – ${b}`;
    }
    if (view === "year") return String(year);
    return cursor.toLocaleDateString("en-US", { month: "long" });
  }, [view, weekStart, year, cursor]);

  function shift(delta: number) {
    if (view === "week") {
      setCursor(addDays(cursor, delta * 7));
      return;
    }
    if (view === "year") {
      setCursor(new Date(year + delta, month, 1));
      return;
    }
    setCursor(new Date(year, month + delta, 1));
  }

  function navLabel(): string {
    if (view === "week") {
      const end = addDays(weekStart, 6);
      return `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    }
    if (view === "year") return String(year);
    return monthLabel(cursor);
  }

  const monthlyGoalPnl =
    view === "month" ? stats.netPnl : (monthCalendar?.total_pnl ?? stats.netPnl);

  const loading = accountsLoading || (isLoading && !!accountId);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[var(--color-background)] lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 sm:px-6">
          <h1 className="text-[20px] font-semibold tracking-tight text-[var(--color-text-primary)]">
            Calendar
          </h1>
          <div className="flex items-center rounded-md border border-[#E2E2E7] bg-white p-0.5">
            {(
              [
                { key: "week", label: "Week" },
                { key: "month", label: "Month" },
                { key: "year", label: "Year" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setView(tab.key)}
                className={clsx(
                  "h-8 rounded-[5px] px-4 text-xs font-medium transition-colors duration-150",
                  view === tab.key
                    ? "bg-[var(--color-primary-light)] text-primary"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          <div className="mb-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => shift(-1)}
              className="rounded-md border border-[#E2E2E7] bg-white p-1.5 text-[var(--color-text-secondary)] transition-colors duration-150 hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)]"
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
            </button>
            <h2 className="min-w-[160px] text-sm font-semibold text-[var(--color-text-primary)]">
              {navLabel()}
            </h2>
            <button
              type="button"
              onClick={() => shift(1)}
              className="rounded-md border border-[#E2E2E7] bg-white p-1.5 text-[var(--color-text-secondary)] transition-colors duration-150 hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)]"
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => setCursor(new Date())}
              className="ml-2 text-xs font-medium text-[var(--color-text-secondary)] hover:text-primary"
            >
              Today
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-[88px] rounded-lg" />
              ))}
            </div>
          ) : isError ? (
            <div className="dash-card border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-[var(--color-text-primary)]">
              Couldn’t load calendar.{" "}
              <button
                type="button"
                onClick={() => refetch()}
                className="font-medium text-primary hover:underline"
              >
                Try again
              </button>
            </div>
          ) : view === "week" ? (
            <WeekGrid
              weekStart={weekStart}
              days={calendar?.days ?? []}
              marks={marks}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
          ) : view === "year" ? (
            <YearHeatmap
              year={year}
              days={calendar?.days ?? []}
              onSelectMonth={(m) => {
                setCursor(new Date(year, m, 1));
                setView("month");
              }}
            />
          ) : (
            <MonthGrid
              year={year}
              month={month}
              days={calendar?.days ?? []}
              marks={marks}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
          )}

          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-[12px] font-medium text-[var(--color-text-secondary)]">
            <LegendItem icon={<Sun className="h-3.5 w-3.5 text-amber-600" />} label="Mood" />
            <LegendItem icon={<BookOpen className="h-3.5 w-3.5 text-sky-600" />} label="Journaled" />
            <LegendItem
              icon={<RefreshCw className="h-3.5 w-3.5 text-violet-600" />}
              label="Routines"
            />
          </div>
        </div>
      </div>

      <CalendarSidebar
        periodLabel={periodLabel}
        goalCurrent={monthlyGoalPnl}
        stats={stats}
      />
    </div>
  );
}

function LegendItem({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {icon}
      <span>{label}</span>
    </div>
  );
}
