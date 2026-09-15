"use client";

import { useMemo, useState } from "react";

import { AccountBalanceChart } from "@/components/dashboard/zella/AccountBalanceChart";
import { DASH_CALENDAR_H } from "@/components/dashboard/zella/ChartCard";
import {
  CumulativePnlChart,
  DailyPnlChart,
  ZellaScoreCard,
} from "@/components/dashboard/zella/DashboardCharts";
import { DrawdownChart } from "@/components/dashboard/zella/DrawdownChart";
import { MetricCards } from "@/components/dashboard/zella/MetricCards";
import { ShareablePnlCalendar } from "@/components/dashboard/zella/ShareablePnlCalendar";
import { PositionsTradesWidget } from "@/components/dashboard/zella/PositionsTradesWidget";
import { ProgressTracker } from "@/components/dashboard/zella/ProgressTracker";
import { TradeScatterChart } from "@/components/dashboard/zella/TradeScatterChart";
import { ZellaDashboardHeader } from "@/components/dashboard/zella/ZellaDashboardHeader";
import { useDashboardWidgets } from "@/components/dashboard/zella/useDashboardWidgets";
import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useAddTradeModal } from "@/components/trade/useAddTradeModal";
import { Skeleton } from "@/components/ui/Skeleton";
import { firstName } from "@/lib/format";
import {
  accountBalanceSeries,
  drawdownSeries,
  equityFromClosedTrades,
  progressGrid,
  tradeDurationPoints,
  tradeTimePoints,
} from "@/lib/dashboardSeries";
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
  const { user } = useAuth();
  const { displayPnl, formatMoney, activeAccount, loading: accountsLoading } = useAccountPrefs();
  const { openFlow } = useAddTradeModal();
  const name = firstName(user?.name, user?.email);
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
  } = useAnalytics(
    { account_id: accountId, date_from: dateFrom, date_to: dateTo },
    { enabled: accountReady }
  );

  const {
    data: trades = [],
    isLoading: tradesLoading,
    isError: tradesError,
  } = useTrades(
    {
      account_id: accountId,
      date_from: `${dateFrom}T00:00:00`,
      date_to: `${dateTo}T23:59:59`,
      limit: 500,
    },
    { enabled: accountReady }
  );

  const progressRange = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 20 * 7);
    return { from: localIso(from), to: localIso(to) };
  }, []);

  const { data: calendar } = useCalendar(calStart, calEnd, accountId, { enabled: accountReady });
  const { data: rangeCalendar } = useCalendar(dateFrom, dateTo, accountId, {
    enabled: accountReady,
  });
  const { data: progressCalendar } = useCalendar(progressRange.from, progressRange.to, accountId, {
    enabled: accountReady && widgets.progress,
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

  const equityPoints = useMemo(() => {
    if (analytics?.equity_curve?.length) return analytics.equity_curve;
    return equityFromClosedTrades(closed, (t) => displayPnl(t.pnl, t.fees) ?? 0);
  }, [analytics?.equity_curve, closed, displayPnl]);
  const initialBalance = Number(activeAccount?.initial_balance ?? 0);

  const balanceSeries = useMemo(
    () => accountBalanceSeries(equityPoints, initialBalance, formatChartDate),
    [equityPoints, initialBalance, formatChartDate]
  );
  const ddSeries = useMemo(() => drawdownSeries(equityPoints, formatChartDate), [equityPoints, formatChartDate]);
  const timePoints = useMemo(
    () => tradeTimePoints(closed, (t) => displayPnl(t.pnl, t.fees) ?? 0),
    [closed, displayPnl]
  );
  const durationPoints = useMemo(
    () => tradeDurationPoints(closed, (t) => displayPnl(t.pnl, t.fees) ?? 0),
    [closed, displayPnl]
  );
  const progress = useMemo(
    () => progressGrid(progressCalendar?.days ?? rangeCalendar?.days ?? []),
    [progressCalendar?.days, rangeCalendar?.days]
  );

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

  const expectancy = useMemo(() => {
    if (closed.length) {
      const total = closed.reduce((s, t) => s + (displayPnl(t.pnl, t.fees) ?? 0), 0);
      return total / closed.length;
    }
    return overview?.expectancy ?? null;
  }, [closed, displayPnl, overview?.expectancy]);

  const expectancySeries = useMemo(() => {
    const sorted = [...closed].sort(
      (a, b) =>
        new Date(a.closed_at || a.opened_at).getTime() -
        new Date(b.closed_at || b.opened_at).getTime()
    );
    let sum = 0;
    return sorted.map((t, i) => {
      sum += displayPnl(t.pnl, t.fees) ?? 0;
      return sum / (i + 1);
    });
  }, [closed, displayPnl]);

  const hour = new Date().getHours();
  const greetingKey =
    hour < 12
      ? "dashboard.greeting.morning"
      : hour < 17
        ? "dashboard.greeting.afternoon"
        : "dashboard.greeting.evening";

  const loading = accountsLoading || analyticsLoading || (tradesLoading && accountReady);
  const hasError = analyticsError || tradesError;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[var(--color-background)]">
      <ZellaDashboardHeader
        dateFrom={dateFrom}
        dateTo={dateTo}
        onRangeChange={(from, to) => {
          setDateFrom(from);
          setDateTo(to);
        }}
        greeting={`${t(greetingKey)}, ${name} 👋`}
        editing={editing}
        onToggleEdit={() => setEditing((v) => !v)}
        onImport={() => openFlow()}
      />

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pt-3 pb-3.5 sm:px-5">
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
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[96px] rounded-[10px]" />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <Skeleton className="h-[260px] rounded-[10px]" />
              <Skeleton className="h-[260px] rounded-[10px]" />
              <Skeleton className="h-[260px] rounded-[10px]" />
            </div>
          </div>
        ) : hasError ? (
          <div className="dash-card border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-foreground">
            Couldn’t load your dashboard data. Refresh the page or try again in a moment.
          </div>
        ) : (
          <>
            <div className="space-y-3">
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
                expectancy={expectancy}
                avgR={overview?.avg_r_multiple ?? null}
                expectancySeries={expectancySeries}
                formatMoney={formatMoney}
              />
            )}

            {(widgets.score || widgets.cumulative || widgets.daily) && (
              <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-3">
                {widgets.score && (
                  <div className="min-w-0">
                    <ZellaScoreCard
                      winRate={winRate}
                      profitFactor={profitFactor}
                      avgWinLoss={avgWinLoss}
                    />
                  </div>
                )}
                {widgets.cumulative && (
                  <div className="min-w-0">
                    <CumulativePnlChart series={equitySeries} formatMoney={formatMoney} />
                  </div>
                )}
                {widgets.daily && (
                  <div className="min-w-0">
                    <DailyPnlChart series={dailySeries} formatMoney={formatMoney} />
                  </div>
                )}
              </div>
            )}

            {(widgets.positions || widgets.accountBalance || widgets.calendar) && (
              <div
                className="grid grid-cols-1 items-stretch gap-3 lg:h-[var(--dash-cal-h)] lg:grid-cols-3"
                style={{ ["--dash-cal-h" as string]: `${DASH_CALENDAR_H}px` }}
              >
                {(widgets.positions || widgets.accountBalance) && (
                  <div
                    className={
                      widgets.positions && widgets.accountBalance
                        ? "grid h-[420px] min-h-0 grid-rows-2 gap-3 overflow-hidden lg:h-full"
                        : "flex h-[420px] min-h-0 flex-col overflow-hidden lg:h-full"
                    }
                  >
                    {widgets.positions && (
                      <PositionsTradesWidget
                        compact
                        openTrades={openTrades}
                        recentTrades={recentTrades}
                        formatMoney={formatMoney}
                      />
                    )}
                    {widgets.accountBalance && (
                      <AccountBalanceChart series={balanceSeries} formatMoney={formatMoney} />
                    )}
                  </div>
                )}
                {widgets.calendar && (
                  <div className="h-[360px] min-w-0 lg:col-span-2 lg:h-full">
                    <ShareablePnlCalendar
                      className="h-full min-h-0 min-w-0"
                      days={calendar?.days ?? []}
                      month={calStart}
                      onMonthChange={(start, end) => {
                        setCalStart(start);
                        setCalEnd(end);
                      }}
                      onSelectDate={(date) => {
                        setDateFrom(date);
                        setDateTo(date);
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {(widgets.drawdown || widgets.tradeTime || widgets.tradeDuration) && (
              <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-3">
                {widgets.drawdown && (
                  <div className="min-w-0">
                    <DrawdownChart series={ddSeries} formatMoney={formatMoney} />
                  </div>
                )}
                {widgets.tradeTime && (
                  <div className="min-w-0">
                    <TradeScatterChart
                      title="Trade time performance"
                      hint="Each point is a closed trade plotted by entry time of day versus P&L."
                      series={timePoints}
                      formatMoney={formatMoney}
                      xMode="clock"
                    />
                  </div>
                )}
                {widgets.tradeDuration && (
                  <div className="min-w-0">
                    <TradeScatterChart
                      title="Trade duration performance"
                      hint="Each point is a closed trade plotted by hold time versus P&L."
                      series={durationPoints}
                      formatMoney={formatMoney}
                      xMode="duration"
                    />
                  </div>
                )}
              </div>
            )}

            {widgets.progress && (
              <ProgressTracker weeks={progress.weeks} monthLabels={progress.monthLabels} />
            )}
            </div>
          </>
        )}
        <div className="h-2" />
      </div>
    </div>
  );
}
