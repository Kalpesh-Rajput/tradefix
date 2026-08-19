"use client";

import { LayoutGrid, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

import { MetricCards } from "@/components/dashboard/zella/MetricCards";
import {
  CumulativePnlChart,
  DailyPnlChart,
  ZellaScoreCard,
} from "@/components/dashboard/zella/DashboardCharts";
import { DashboardCalendar } from "@/components/dashboard/zella/DashboardCalendar";
import { PositionsTradesWidget } from "@/components/dashboard/zella/PositionsTradesWidget";
import { ZellaDashboardHeader } from "@/components/dashboard/zella/ZellaDashboardHeader";
import { useDashboardWidgets } from "@/components/dashboard/zella/useDashboardWidgets";
import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useAddTradeModal } from "@/components/trade/useAddTradeModal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAnalytics, useCalendar } from "@/lib/hooks/useAnalytics";
import { useTrades } from "@/lib/hooks/useTrades";

function localIso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);
  return { from: localIso(start), to: localIso(end) };
}

export default function TodayPage() {
  const { t, formatChartDate } = useLocale();
  const { displayPnl, formatMoney, activeAccount, loading: accountsLoading } = useAccountPrefs();
  const { openModal } = useAddTradeModal();
  const { widgets, editing, setEditing, toggle, labels } = useDashboardWidgets();
  const accountId = activeAccount?.id;
  const accountReady = !!accountId;

  const initial = useMemo(() => defaultRange(), []);
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);

  const monthBounds = useMemo(() => {
    const d = new Date();
    return {
      start: localIso(new Date(d.getFullYear(), d.getMonth(), 1)),
      end: localIso(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
    };
  }, []);
  const [calStart, setCalStart] = useState(monthBounds.start);
  const [calEnd, setCalEnd] = useState(monthBounds.end);

  const {
    data: analytics,
    isLoading: analyticsLoading,
    isError: analyticsError,
    refetch: refetchAnalytics,
  } = useAnalytics(
    { account_id: accountId, date_from: dateFrom, date_to: dateTo },
    { enabled: accountReady }
  );

  const {
    data: trades = [],
    isLoading: tradesLoading,
    isError: tradesError,
    refetch: refetchTrades,
  } = useTrades(
    {
      account_id: accountId,
      date_from: `${dateFrom}T00:00:00`,
      date_to: `${dateTo}T23:59:59`,
      limit: 500,
    },
    { enabled: accountReady }
  );

  const { data: calendar } = useCalendar(calStart, calEnd, accountId, { enabled: accountReady });
  const { data: rangeCalendar, refetch: refetchRangeCal } = useCalendar(dateFrom, dateTo, accountId, {
    enabled: accountReady,
  });

  const overview = analytics?.overview;
  const closed = useMemo(
    () => trades.filter((t) => t.status === "closed" && t.pnl != null),
    [trades]
  );
  const openTrades = useMemo(() => trades.filter((t) => t.status === "open"), [trades]);
  const winsList = closed.filter((t) => (displayPnl(t.pnl, t.fees) ?? 0) > 0);
  const lossesList = closed.filter((t) => (displayPnl(t.pnl, t.fees) ?? 0) < 0);
  const beList = closed.filter((t) => (displayPnl(t.pnl, t.fees) ?? 0) === 0);
  const grossWin = winsList.reduce((s, t) => s + (displayPnl(t.pnl, t.fees) ?? 0), 0);
  const grossLoss = Math.abs(lossesList.reduce((s, t) => s + (displayPnl(t.pnl, t.fees) ?? 0), 0));
  const profitFactor =
    overview?.profit_factor ||
    (grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? grossWin : 0);
  const winRate = closed.length
    ? (winsList.length / closed.length) * 100
    : overview?.win_rate ?? 0;
  const netPnl =
    overview?.total_pnl ??
    closed.reduce((s, t) => s + (displayPnl(t.pnl, t.fees) ?? 0), 0);
  const avgWin = winsList.length ? grossWin / winsList.length : overview?.avg_win ?? 0;
  const avgLoss = lossesList.length
    ? Math.abs(lossesList.reduce((s, t) => s + (displayPnl(t.pnl, t.fees) ?? 0), 0) / lossesList.length)
    : Math.abs(overview?.avg_loss ?? 0);
  const avgWinLoss = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? avgWin : 0;

  const tradingDays = rangeCalendar?.days?.filter((d) => d.trades > 0) ?? [];
  const dayWins = tradingDays.filter((d) => d.pnl > 0).length;
  const dayLosses = tradingDays.filter((d) => d.pnl < 0).length;
  const dayBreakeven = tradingDays.filter((d) => d.pnl === 0).length;
  const dayWinPct = tradingDays.length ? (dayWins / tradingDays.length) * 100 : null;

  const equitySeries = useMemo(() => {
    if (analytics?.equity_curve?.length) {
      return analytics.equity_curve.map((p) => ({
        date: formatChartDate(new Date(p.date + "T12:00:00")),
        value: p.value,
      }));
    }
    let sum = 0;
    return [...closed]
      .sort(
        (a, b) =>
          new Date(a.closed_at || a.opened_at).getTime() -
          new Date(b.closed_at || b.opened_at).getTime()
      )
      .map((t) => {
        sum += displayPnl(t.pnl, t.fees) ?? 0;
        return {
          date: formatChartDate(new Date(t.closed_at || t.opened_at)),
          value: sum,
        };
      });
  }, [analytics?.equity_curve, closed, formatChartDate, displayPnl]);

  const dailySeries = useMemo(() => {
    const days = rangeCalendar?.days ?? [];
    return days
      .filter((d) => d.trades > 0)
      .map((d) => ({
        date: formatChartDate(new Date(d.date + "T12:00:00")),
        value: d.pnl,
      }));
  }, [rangeCalendar?.days, formatChartDate]);

  const recentTrades = useMemo(
    () =>
      [...closed].sort(
        (a, b) =>
          new Date(b.closed_at || b.opened_at).getTime() -
          new Date(a.closed_at || a.opened_at).getTime()
      ),
    [closed]
  );

  const lastClosed = recentTrades[0];
  const lastImportLabel = lastClosed
    ? new Date(lastClosed.closed_at || lastClosed.opened_at).toLocaleString(undefined, {
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  const hour = new Date().getHours();
  const greetingKey =
    hour < 12
      ? "dashboard.greeting.morning"
      : hour < 17
        ? "dashboard.greeting.afternoon"
        : "dashboard.greeting.evening";

  const loading = accountsLoading || analyticsLoading || (tradesLoading && accountReady);
  const hasError = analyticsError || tradesError;

  function refreshAll() {
    void refetchAnalytics();
    void refetchTrades();
    void refetchRangeCal();
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[var(--color-background)]">
      <ZellaDashboardHeader
        dateFrom={dateFrom}
        dateTo={dateTo}
        onRangeChange={(from, to) => {
          setDateFrom(from);
          setDateTo(to);
        }}
      />

      <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-4 py-3.5 sm:px-5">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-[13px] font-medium leading-5 tracking-tight text-[#202127]">
            {t(greetingKey)}!
          </h2>

          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
            <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-secondary)]">
              <span>{t("dashboard.lastImport", { when: lastImportLabel })}</span>
              <button
                type="button"
                onClick={refreshAll}
                className="rounded p-0.5 text-[var(--color-text-muted)] transition-colors duration-150 hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-secondary)]"
                aria-label="Refresh"
                title="Refresh"
              >
                <RefreshCw className="h-3 w-3" strokeWidth={1.75} />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="dash-btn-secondary"
              aria-pressed={editing}
            >
              <LayoutGrid className="h-3.5 w-3.5" strokeWidth={1.75} />
              {editing ? "Done" : t("dashboard.editWidgets")}
            </button>
            <button
              type="button"
              onClick={() => openModal("csv")}
              className="dash-btn-primary text-on-accent"
            >
              + {t("dashboard.importTrades")}
            </button>
          </div>
        </div>

        {editing && (
          <div className="dash-card flex flex-wrap gap-2 p-4">
            {(Object.keys(labels) as Array<keyof typeof labels>).map((id) => (
              <label
                key={id}
                className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] transition-colors duration-150 hover:bg-[var(--color-primary-very-light)]"
              >
                <input
                  type="checkbox"
                  checked={widgets[id]}
                  onChange={() => toggle(id)}
                  className="rounded border-[var(--color-border)] text-primary focus:ring-primary"
                />
                {labels[id]}
              </label>
            ))}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-[96px] rounded-[10px]" />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.15fr_1fr_1fr]">
              <Skeleton className="h-[240px] rounded-[10px]" />
              <Skeleton className="h-[240px] rounded-[10px]" />
              <Skeleton className="h-[240px] rounded-[10px]" />
            </div>
          </div>
        ) : hasError ? (
          <div className="dash-card border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-foreground">
            Couldn’t load your dashboard data. Refresh the page or try again in a moment.
          </div>
        ) : (
          <>
            {widgets.metrics && (
              <MetricCards
                netPnl={netPnl}
                winRate={winRate}
                profitFactor={profitFactor}
                dayWinPct={dayWinPct}
                avgWin={avgWin}
                avgLoss={avgLoss}
                wins={winsList.length}
                losses={lossesList.length}
                breakeven={beList.length}
                dayWins={dayWins}
                dayLosses={dayLosses}
                dayBreakeven={dayBreakeven}
                formatMoney={formatMoney}
              />
            )}

            {(widgets.score || widgets.cumulative || widgets.daily) && (
              <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[1.15fr_1fr_1fr]">
                {widgets.score && (
                  <ZellaScoreCard
                    winRate={winRate}
                    profitFactor={profitFactor}
                    avgWinLoss={avgWinLoss}
                  />
                )}
                {widgets.cumulative && (
                  <CumulativePnlChart series={equitySeries} formatMoney={formatMoney} />
                )}
                {widgets.daily && (
                  <DailyPnlChart series={dailySeries} formatMoney={formatMoney} />
                )}
              </div>
            )}

            {(widgets.positions || widgets.calendar) && (
              <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[1fr_1.45fr]">
                {widgets.positions && (
                  <PositionsTradesWidget
                    openTrades={openTrades}
                    recentTrades={recentTrades}
                    formatMoney={formatMoney}
                  />
                )}
                {widgets.calendar && (
                  <DashboardCalendar
                    days={calendar?.days ?? []}
                    onMonthChange={(start, end) => {
                      setCalStart(start);
                      setCalEnd(end);
                    }}
                    onSelectDate={(date) => {
                      setDateFrom(date);
                      setDateTo(date);
                    }}
                  />
                )}
              </div>
            )}
          </>
        )}
        <div className="h-2" />
      </div>
    </div>
  );
}
