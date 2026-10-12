"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { AccountBalanceChart } from "@/components/dashboard/zella/AccountBalanceChart";
import { DASH_CALENDAR_H } from "@/components/dashboard/zella/ChartCard";
import { CumulativePnlChart, DailyPnlChart } from "@/components/dashboard/zella/DashboardCharts";
import { TradeFixScoreCard } from "@/components/dashboard/tradefix-score/TradeFixScoreCard";
import { DrawdownChart } from "@/components/dashboard/zella/DrawdownChart";
import { MarketSessionsWidget } from "@/components/market-sessions/MarketSessionsWidget";
import { MetricCards } from "@/components/dashboard/zella/MetricCards";
import { ShareablePnlCalendar } from "@/components/dashboard/zella/ShareablePnlCalendar";
import { PositionsTradesWidget } from "@/components/dashboard/zella/PositionsTradesWidget";
import { ProgressTracker } from "@/components/dashboard/zella/ProgressTracker";
import { TradeScatterChart } from "@/components/dashboard/zella/TradeScatterChart";
import { ZellaDashboardHeader } from "@/components/dashboard/zella/ZellaDashboardHeader";
import { useDashboardWidgets } from "@/components/dashboard/zella/useDashboardWidgets";
import { AdvancedFilterDialog } from "@/components/trades/AdvancedFilterDialog";
import { DayDetailModal } from "@/components/dayview/DayDetailModal";
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
  tradeDurationPoints,
  tradeTimePoints,
} from "@/lib/dashboardSeries";
import { rangeForPreset } from "@/components/dashboard/DateRangePicker";
import { usePublishAssistantScope } from "@/lib/ai/assistant-scope";
import { localIso } from "@/lib/dateLocal";
import { TRADE_LIST_LIMIT } from "@/lib/trades/limits";
import { PerformanceAnalytics } from "@/components/dashboard/analytics/PerformanceAnalytics";
import { useDashboardAdvancedFilters } from "@/lib/hooks/useDashboardFilters";
import { useAnalytics, useCalendar } from "@/lib/hooks/useAnalytics";
import { useTrades } from "@/lib/hooks/useTrades";
import type { DashboardJournalQuery } from "@/lib/trades/dashboardFilters";
import {
  DEFAULT_FILTERS,
  matchesTrade,
  type LocalFilters,
} from "@/lib/trades/logFilters";

export default function TodayPage() {
  const { t, formatChartDate } = useLocale();
  const { user } = useAuth();
  const { displayPnl, formatMoney, currencySymbol, activeAccount, loading: accountsLoading, pnlDisplayMode } =
    useAccountPrefs();
  const { openFlow } = useAddTradeModal();
  const name = firstName(user?.name, user?.email);
  const { widgets, editing, setEditing, toggle, labels } = useDashboardWidgets();
  const accountId = activeAccount?.id;
  const accountReady = !!accountId;

  const initial = useMemo(() => rangeForPreset("30d"), []);
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const dashboardFilters = useDashboardAdvancedFilters(user?.save_filters);
  const todayKey = localIso(new Date());
  const journalQuery = useMemo<DashboardJournalQuery | null>(() => {
    if (!dashboardFilters.active) return null;
    return {
      ...dashboardFilters.filters,
      today: todayKey,
      pnl_mode: pnlDisplayMode === "gross" ? "gross" : "net",
    };
  }, [dashboardFilters.active, dashboardFilters.filters, todayKey, pnlDisplayMode]);
  const tradeFilters = useMemo<LocalFilters>(
    () => ({ ...DEFAULT_FILTERS, ...dashboardFilters.filters }),
    [dashboardFilters.filters]
  );
  const filterDetail = useMemo(() => {
    if (!dashboardFilters.active) return null;
    const selected = dashboardFilters.filters;
    const named = [
      selected.symbol && `Symbol ${selected.symbol}`,
      selected.setup_tag && `Strategy ${selected.setup_tag}`,
      selected.session && `Session ${selected.session}`,
      selected.side && `Side ${selected.side}`,
      selected.status !== "all" && `Status ${selected.status}`,
      selected.pnl && `P&L ${selected.pnl}`,
    ].filter(Boolean);
    const summary = named.join(", ");
    return summary
      ? `Advance filter (${dashboardFilters.count}): ${summary}`
      : `Advance filter (${dashboardFilters.count})`;
  }, [dashboardFilters.active, dashboardFilters.count, dashboardFilters.filters]);
  usePublishAssistantScope({ dateFrom, dateTo, detail: filterDetail });

  const monthBounds = useMemo(() => {
    const d = new Date();
    return {
      start: localIso(new Date(d.getFullYear(), d.getMonth(), 1)),
      end: localIso(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
    };
  }, []);
  const [calStart, setCalStart] = useState(monthBounds.start);
  const [calEnd, setCalEnd] = useState(monthBounds.end);
  const [openDate, setOpenDate] = useState<string | null>(null);

  const {
    data: analytics,
    isLoading: analyticsLoading,
    isError: analyticsError,
    refetch: refetchAnalytics,
  } = useAnalytics(
    { account_id: accountId, date_from: dateFrom, date_to: dateTo, journal: journalQuery },
    { enabled: accountReady }
  );

  const {
    data: trades = [],
    isError: tradesError,
    refetch: refetchTrades,
  } = useTrades(
    {
      account_id: accountId,
      date_from: `${dateFrom}T00:00:00`,
      date_to: `${dateTo}T23:59:59`,
      limit: TRADE_LIST_LIMIT,
    },
    { enabled: accountReady }
  );
  const tradesTruncated = trades.length >= TRADE_LIST_LIMIT;

  const { data: calendar } = useCalendar(calStart, calEnd, accountId, {
    enabled: accountReady,
    journal: journalQuery,
  });
  const { data: rangeCalendar } = useCalendar(dateFrom, dateTo, accountId, {
    enabled: accountReady,
    journal: journalQuery,
  });
  const overview = analytics?.overview;
  const netPnl = overview?.total_pnl ?? 0;
  const winRate = overview?.win_rate ?? 0;
  const profitFactor = overview?.profit_factor ?? 0;
  const avgWin = overview?.avg_win ?? 0;
  const avgLoss = Math.abs(overview?.avg_loss ?? 0);
  const expectancy = overview?.expectancy ?? null;
  const wins = overview?.win_count ?? 0;
  const losses = overview?.loss_count ?? 0;
  const breakeven = overview?.breakeven_count ?? 0;
  const visibleTrades = useMemo(
    () => trades.filter((trade) => matchesTrade(trade, tradeFilters, displayPnl)),
    [trades, tradeFilters, displayPnl]
  );
  const closed = useMemo(
    () => visibleTrades.filter((t) => t.status === "closed" && t.pnl != null),
    [visibleTrades]
  );
  const openTrades = useMemo(() => visibleTrades.filter((t) => t.status === "open"), [visibleTrades]);

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
    if (dashboardFilters.active) return [];
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
  }, [analytics?.equity_curve, closed, formatChartDate, displayPnl, dashboardFilters.active]);

  const equityPoints = useMemo(() => {
    if (analytics?.equity_curve?.length) return analytics.equity_curve;
    if (dashboardFilters.active) return [];
    return equityFromClosedTrades(closed, (t) => displayPnl(t.pnl, t.fees) ?? 0);
  }, [analytics?.equity_curve, closed, displayPnl, dashboardFilters.active]);
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

  const expectancySeries = useMemo(() => {
    const curve = analytics?.equity_curve ?? [];
    return curve.map((p, i) => p.value / (i + 1));
  }, [analytics?.equity_curve]);

  const hour = new Date().getHours();
  const greetingKey =
    hour < 12
      ? "dashboard.greeting.morning"
      : hour < 17
        ? "dashboard.greeting.afternoon"
        : "dashboard.greeting.evening";

  const loading = accountsLoading || (accountReady && analyticsLoading);
  const metricsEntered = useRef(false);
  const playMetricsEnter = !metricsEntered.current;
  useEffect(() => {
    if (!loading && widgets.metrics) metricsEntered.current = true;
  }, [loading, widgets.metrics]);
  const hasError = analyticsError;

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
        filterCount={dashboardFilters.count}
        filtersOpen={dashboardFilters.open}
        onOpenFilters={() => dashboardFilters.setOpen(true)}
      />

      <div className="dash-board min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto px-3 pt-3 pb-3.5 sm:px-4 lg:px-5">
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
            <div className="dash-metrics">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[96px] rounded-[10px]" />
              ))}
            </div>
            <div className="dash-charts">
              <Skeleton className="h-[260px] rounded-[10px]" />
              <Skeleton className="h-[260px] rounded-[10px]" />
              <Skeleton className="h-[260px] rounded-[10px]" />
            </div>
          </div>
        ) : hasError ? (
          <div className="dash-card border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-foreground">
            Couldn’t load your dashboard data.
            <button
              type="button"
              className="ml-3 text-primary"
              onClick={() => void refetchAnalytics()}
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
            {dashboardFilters.active && (overview?.total_trades ?? 0) === 0 && openTrades.length === 0 ? (
              <div className="dash-card px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                No trades match these filters.
              </div>
            ) : null}
            {widgets.metrics && (
              <MetricCards
                animate={playMetricsEnter}
                netPnl={netPnl}
                winRate={winRate}
                profitFactor={profitFactor}
                dayWinPct={dayWinPct}
                avgWin={avgWin}
                avgLoss={avgLoss}
                wins={wins}
                losses={losses}
                breakeven={breakeven}
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
              <div className="dash-charts">
                {widgets.score && (
                  <div className="min-w-0">
                    <TradeFixScoreCard score={overview?.tradefix_score} formatMoney={formatMoney} />
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

            {tradesError ? (
              <div className="dash-card border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-foreground">
                Couldn’t load trades for this range.
                <button type="button" className="ml-3 text-primary" onClick={() => void refetchTrades()}>
                  Retry
                </button>
              </div>
            ) : null}

            {(widgets.positions || widgets.accountBalance || widgets.calendar) && (
              <div
                className="dash-split"
                style={{ ["--dash-cal-h" as string]: `${DASH_CALENDAR_H}px` }}
              >
                {(widgets.positions || widgets.accountBalance) && (
                  <div
                    className={
                      widgets.positions && widgets.accountBalance
                        ? "dash-split-side"
                        : "dash-split-side is-single"
                    }
                  >
                    {widgets.positions && (
                      <PositionsTradesWidget
                        compact
                        openTrades={openTrades}
                        recentTrades={recentTrades}
                        formatMoney={formatMoney}
                        displayPnl={displayPnl}
                        truncated={tradesTruncated}
                      />
                    )}
                    {widgets.accountBalance && (
                      <AccountBalanceChart series={balanceSeries} formatMoney={formatMoney} />
                    )}
                  </div>
                )}
                {widgets.calendar && (
                  <div
                    className={
                      widgets.positions || widgets.accountBalance
                        ? "dash-calendar-slot"
                        : "dash-calendar-slot is-full"
                    }
                  >
                    <ShareablePnlCalendar
                      className="h-full min-h-0 min-w-0"
                      days={calendar?.days ?? []}
                      month={calStart}
                      onMonthChange={(start, end) => {
                        setCalStart(start);
                        setCalEnd(end);
                      }}
                      onOpenDate={setOpenDate}
                    />
                  </div>
                )}
              </div>
            )}

            {(widgets.drawdown || widgets.tradeTime || widgets.tradeDuration) && (
              <div className="dash-charts">
                {widgets.drawdown && (
                  <div className="min-w-0">
                    <DrawdownChart series={ddSeries} formatMoney={formatMoney} />
                  </div>
                )}
                {widgets.tradeTime && (
                  <div className="min-w-0">
                    <TradeScatterChart
                      title={t("dashboard.tradeTime")}
                      hint={t("dashboard.hint.tradeTime")}
                      series={timePoints}
                      formatMoney={formatMoney}
                      xMode="clock"
                    />
                    {tradesTruncated ? (
                      <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                        Chart uses the latest {TRADE_LIST_LIMIT.toLocaleString()} trades in this range.
                      </p>
                    ) : null}
                  </div>
                )}
                {widgets.tradeDuration && (
                  <div className="min-w-0">
                    <TradeScatterChart
                      title={t("dashboard.tradeDuration")}
                      hint={t("dashboard.hint.tradeDuration")}
                      series={durationPoints}
                      formatMoney={formatMoney}
                      xMode="duration"
                    />
                    {tradesTruncated ? (
                      <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                        Chart uses the latest {TRADE_LIST_LIMIT.toLocaleString()} trades in this range.
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            {(widgets.progress || widgets.marketSessions) && (
              <div className="dash-charts">
                {widgets.progress && (
                  <div className={`min-w-0 ${widgets.marketSessions ? "dash-span-2" : "dash-span-3"}`}>
                    <ProgressTracker accountId={accountId} enabled={!accountsLoading} />
                  </div>
                )}
                {widgets.marketSessions && (
                  <div className={`min-w-0 ${widgets.progress ? "" : "dash-span-3"}`}>
                    <MarketSessionsWidget />
                  </div>
                )}
              </div>
            )}

            {widgets.performanceAnalytics && (
              <PerformanceAnalytics
                data={analytics?.performance}
                formatMoney={formatMoney}
                currencySymbol={currencySymbol}
              />
            )}
            </div>
          </>
        )}
        <div className="h-2" />
      </div>
      <DayDetailModal
        date={openDate}
        day={calendar?.days.find((d) => d.date.slice(0, 10) === openDate)}
        journal={journalQuery}
        onClose={() => setOpenDate(null)}
      />
      <AdvancedFilterDialog
        open={dashboardFilters.open}
        filters={tradeFilters}
        trades={trades}
        onClose={() => dashboardFilters.setOpen(false)}
        onApply={(next) => {
          dashboardFilters.setFilters(next);
          dashboardFilters.setOpen(false);
        }}
      />
    </div>
  );
}
