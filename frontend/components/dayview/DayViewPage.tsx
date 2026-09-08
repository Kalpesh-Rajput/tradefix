"use client";

import { useMemo, useState } from "react";

import { DayCard, type DayViewRow } from "@/components/dayview/DayCard";
import { DayViewCalendar } from "@/components/dayview/DayViewCalendar";
import { DayViewHeader } from "@/components/dayview/DayViewHeader";
import { DayNoteEditor } from "@/components/dayview/notes/DayNoteEditor";
import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useAddTradeModal } from "@/components/trade/useAddTradeModal";
import { Skeleton } from "@/components/ui/Skeleton";
import { localIso, parseLocalIso, startOfWeekSunday } from "@/lib/dateLocal";
import { useCalendar } from "@/lib/hooks/useAnalytics";
import { useTrades } from "@/lib/hooks/useTrades";
import type { CalendarDay, Trade } from "@/lib/types";

function todayIso() {
  return localIso(new Date());
}

function monthRange() {
  const now = new Date();
  return {
    from: localIso(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: todayIso(),
  };
}

function clampRange(from: string, to: string) {
  const today = todayIso();
  const end = to > today ? today : to;
  const start = from > end ? end : from;
  return { from: start, to: end };
}

function formatDayTitle(iso: string, locale: string) {
  return parseLocalIso(iso).toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function mergeDays(days: CalendarDay[], id: string, title: string, date: string): DayViewRow {
  const pnl = days.reduce((s, d) => s + d.pnl, 0);
  const trades = days.reduce((s, d) => s + d.trades, 0);
  const winners = days.reduce((s, d) => s + (d.winners ?? 0), 0);
  const losers = days.reduce((s, d) => s + (d.losers ?? 0), 0);
  const gross = days.reduce((s, d) => s + (d.gross_pnl ?? d.pnl), 0);
  const volume = days.reduce((s, d) => s + (d.volume ?? 0), 0);
  const commissions = days.reduce((s, d) => s + (d.commissions ?? 0), 0);
  const grossWins = days.reduce((s, d) => s + Math.max(0, d.pnl), 0);
  const grossLosses = Math.abs(days.reduce((s, d) => s + Math.min(0, d.pnl), 0));
  const profit_factor =
    grossLosses > 0 ? Number((grossWins / grossLosses).toFixed(2)) : grossWins > 0 ? Number(grossWins.toFixed(2)) : 0;
  const curve = days.flatMap((d, i) => (i === 0 ? d.curve ?? [0, d.pnl] : (d.curve ?? [d.pnl]).slice(1)));
  return {
    id,
    date,
    title,
    trades,
    pnl: Number(pnl.toFixed(2)),
    win_rate: trades ? Number(((winners / trades) * 100).toFixed(1)) : 0,
    gross_pnl: Number(gross.toFixed(2)),
    volume: Number(volume.toFixed(4)),
    winners,
    losers,
    profit_factor,
    commissions: Number(commissions.toFixed(2)),
    curve: curve.length ? curve : [0, pnl],
  };
}

export function DayViewPage() {
  const { t, locale } = useLocale();
  const { formatMoney, activeAccount, loading: accountsLoading } = useAccountPrefs();
  const { openModal } = useAddTradeModal();
  const accountId = activeAccount?.id;
  const initial = useMemo(() => monthRange(), []);
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const [mode, setMode] = useState<"day" | "week">("day");
  const [noteRow, setNoteRow] = useState<DayViewRow | null>(null);

  const monthBounds = useMemo(() => {
    const cursor = parseLocalIso(dateTo || todayIso());
    return {
      start: localIso(new Date(cursor.getFullYear(), cursor.getMonth(), 1)),
      end: localIso(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)),
    };
  }, [dateTo]);

  const {
    data: calendar,
    isLoading,
    isError,
    refetch,
  } = useCalendar(dateFrom, dateTo, accountId, { enabled: !!accountId });
  const { data: monthCalendar } = useCalendar(monthBounds.start, monthBounds.end, accountId, {
    enabled: !!accountId,
  });

  const { data: trades = [] } = useTrades(
    {
      account_id: accountId,
      date_from: `${dateFrom}T00:00:00`,
      date_to: `${dateTo}T23:59:59`,
      status: "closed",
      limit: 1000,
    },
    { enabled: !!accountId }
  );

  const tradesByDay = useMemo(() => {
    const map = new Map<string, Trade[]>();
    for (const trade of trades) {
      const key = (trade.closed_at || trade.opened_at).slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(trade);
      map.set(key, list);
    }
    return map;
  }, [trades]);

  const rows = useMemo<DayViewRow[]>(() => {
    const days = [...(calendar?.days ?? [])].sort((a, b) => b.date.localeCompare(a.date));
    if (mode === "day") {
      return days.map((d) => ({
        ...d,
        id: d.date.slice(0, 10),
        title: formatDayTitle(d.date.slice(0, 10), locale),
      }));
    }
    const groups = new Map<string, CalendarDay[]>();
    for (const d of days) {
      const week = localIso(startOfWeekSunday(parseLocalIso(d.date.slice(0, 10))));
      const list = groups.get(week) ?? [];
      list.push(d);
      groups.set(week, list);
    }
    return [...groups.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([week, group]) =>
        mergeDays(group, week, t("dayView.weekOf", { date: formatDayTitle(week, locale) }), week)
      );
  }, [calendar?.days, mode, locale, t]);

  function onSelectDate(date: string) {
    const el = document.getElementById(`day-${date}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const week = localIso(startOfWeekSunday(parseLocalIso(date)));
    document.getElementById(`day-${week}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const loading = accountsLoading || (isLoading && !!accountId);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--color-background)]">
      <h1 className="sr-only">{t("dayView.title")}</h1>
      <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5">
        <DayViewHeader mode={mode} onModeChange={setMode} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-3 p-4">
          <div className="flex flex-col-reverse gap-4 xl:flex-row xl:items-start">
            <div className="min-w-0 flex-1 space-y-3">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-40 rounded-lg" />
                <Skeleton className="h-24 rounded-lg" />
              </div>
            ) : isError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-5 text-sm">
                {t("dayView.loadError")}{" "}
                <button type="button" onClick={() => void refetch()} className="text-primary hover:underline">
                  {t("common.retry")}
                </button>
              </div>
            ) : rows.length === 0 ? (
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-12 text-center shadow-[var(--shadow-sm)]">
                <p className="text-[14px] font-medium text-[var(--color-text-primary)]">{t("dayView.empty")}</p>
                <p className="mt-1 text-[13px] text-[var(--color-text-tertiary)]">{t("dayView.emptyHint")}</p>
                <button
                  type="button"
                  onClick={() => openModal("manual")}
                  className="dash-btn-primary text-on-accent mt-4"
                >
                  {t("common.addTrade")}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {rows.map((row) => (
                  <DayCard
                    key={row.id}
                    row={row}
                    formatMoney={formatMoney}
                    trades={
                      mode === "day"
                        ? tradesByDay.get(row.id) ?? []
                        : [...tradesByDay.entries()]
                            .filter(([day]) => localIso(startOfWeekSunday(parseLocalIso(day))) === row.id)
                            .flatMap(([, list]) => list)
                    }
                    onAddNote={() => setNoteRow(row)}
                  />
                ))}
              </div>
            )}
            </div>

            <aside className="w-full shrink-0 xl:sticky xl:top-4 xl:w-[232px]">
            <DayViewCalendar
              days={monthCalendar?.days ?? calendar?.days ?? []}
              month={dateTo}
              onMonthChange={(start, end) => {
                const next = clampRange(start, end);
                setDateFrom(next.from);
                setDateTo(next.to);
              }}
              onSelectDate={(date) => {
                if (date < dateFrom || date > dateTo) {
                  const next = clampRange(date, date);
                  setDateFrom(next.from);
                  setDateTo(next.to);
                }
                window.requestAnimationFrame(() => onSelectDate(date));
              }}
            />
            </aside>
          </div>
        </div>
      </div>
      {noteRow && accountId ? (
        <DayNoteEditor
          accountId={accountId}
          target={{
            date: noteRow.date.slice(0, 10),
            title: noteRow.title,
            pnl: Number(noteRow.pnl),
            trades: noteRow.trades,
            winRate: noteRow.win_rate,
          }}
          formatMoney={formatMoney}
          onClose={() => setNoteRow(null)}
        />
      ) : null}
    </div>
  );
}
