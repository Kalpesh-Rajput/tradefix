"use client";

import { useMemo } from "react";

import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DailyCheckinCard } from "@/components/dashboard/DailyCheckinCard";
import { EmptyTrades } from "@/components/dashboard/EmptyTrades";
import { GoalsProgressCard } from "@/components/dashboard/GoalsProgressCard";
import { IntelligencePanel } from "@/components/dashboard/IntelligencePanel";
import { MilestonesStrip } from "@/components/dashboard/MilestonesStrip";
import { MindsetCheckin } from "@/components/dashboard/MindsetCheckin";
import { buildPerformanceMetrics, PerformanceGrid } from "@/components/dashboard/PerformanceGrid";
import { StreakCards } from "@/components/dashboard/StreakCards";
import { TodaysTrades } from "@/components/dashboard/TodaysTrades";
import { DistanceToBreach } from "@/components/prop/DistanceToBreach";
import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import { buildGoalProgress, yearlyGoalPercent } from "@/lib/goals";
import { useAnalytics, useCalendar } from "@/lib/hooks/useAnalytics";
import { useMoodCheckins } from "@/lib/hooks/useMood";
import { useRecaps } from "@/lib/hooks/useRecaps";
import { useTrades } from "@/lib/hooks/useTrades";
import { consecutiveJournalStreak } from "@/lib/journalStreak";

export default function TodayPage() {
  const { user } = useAuth();
  const { dateKey, formatChartDate, timezone } = useLocale();
  const { displayPnl, activeAccount, loading: accountsLoading } = useAccountPrefs();
  const accountId = activeAccount?.id;

  const accountReady = !!accountId;
  const { data: analytics, isLoading: analyticsLoading, isError: analyticsError } = useAnalytics(
    accountId,
    { enabled: accountReady }
  );
  const { data: trades = [], isLoading: tradesLoading, isError: tradesError } = useTrades(
    { account_id: accountId },
    { enabled: accountReady }
  );
  const { data: mood = [] } = useMoodCheckins();
  const { data: recaps = [] } = useRecaps(accountId);

  const localIso = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const monthStart = useMemo(() => {
    const d = new Date();
    return localIso(new Date(d.getFullYear(), d.getMonth(), 1));
  }, []);
  const monthEnd = useMemo(() => localIso(new Date()), []);

  const weekRange = useMemo(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: localIso(start), end: localIso(end) };
  }, []);

  const { data: calendar } = useCalendar(monthStart, monthEnd, accountId, { enabled: accountReady });
  const { data: weekCalendar } = useCalendar(weekRange.start, weekRange.end, accountId, {
    enabled: accountReady,
  });

  const todayKey = useMemo(() => dateKey(new Date()), [dateKey, timezone]);
  const todaysTrades = useMemo(
    () => trades.filter((t) => dateKey(t.opened_at) === todayKey || (t.closed_at && dateKey(t.closed_at) === todayKey)),
    [trades, todayKey, dateKey]
  );
  const todaysClosed = todaysTrades.filter((t) => t.status === "closed" && t.pnl != null);
  const todaysPnl = todaysClosed.reduce((sum, t) => sum + (displayPnl(t.pnl, t.fees) ?? 0), 0);
  const todaysWins = todaysClosed.filter((t) => (displayPnl(t.pnl, t.fees) ?? 0) > 0);
  const todaysWinRate = todaysClosed.length ? (todaysWins.length / todaysClosed.length) * 100 : null;
  const openCount = trades.filter((t) => t.status === "open").length;

  const overview = analytics?.overview;
  const closed = trades.filter((t) => t.status === "closed" && t.pnl != null);
  const wins = closed.filter((t) => (displayPnl(t.pnl, t.fees) ?? 0) > 0);
  const losses = closed.filter((t) => (displayPnl(t.pnl, t.fees) ?? 0) < 0);
  const grossWin = wins.reduce((s, t) => s + (displayPnl(t.pnl, t.fees) ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (displayPnl(t.pnl, t.fees) ?? 0), 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? grossWin : 0;
  const accountWinRate = closed.length ? (wins.length / closed.length) * 100 : overview?.win_rate ?? 0;
  const accountNetPnl = closed.reduce((s, t) => s + (displayPnl(t.pnl, t.fees) ?? 0), 0);
  const accountAvgWin = wins.length ? grossWin / wins.length : overview?.avg_win ?? 0;
  const expectancy = closed.length ? accountNetPnl / closed.length : overview?.expectancy;

  const goalItems = useMemo(
    () => buildGoalProgress(user, trades, displayPnl),
    [user, trades, displayPnl]
  );
  const ytdPct = useMemo(
    () => yearlyGoalPercent(user, trades, displayPnl) ?? 0,
    [user, trades, displayPnl]
  );

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
          new Date(a.closed_at || a.opened_at).getTime() - new Date(b.closed_at || b.opened_at).getTime()
      )
      .map((t) => {
        sum += displayPnl(t.pnl, t.fees) ?? 0;
        const d = new Date(t.closed_at || t.opened_at);
        return {
          date: formatChartDate(d),
          value: sum,
        };
      });
  }, [analytics?.equity_curve, closed, formatChartDate, displayPnl]);

  const bestWin = useMemo(() => {
    if (overview && overview.largest_win > 0) {
      const match = wins.find((t) => Math.abs((displayPnl(t.pnl, t.fees) ?? 0) - overview.largest_win) < 0.01);
      if (match) {
        return {
          symbol: match.symbol,
          pnl: displayPnl(match.pnl, match.fees) ?? overview.largest_win,
          date: match.closed_at || match.opened_at,
        };
      }
      return { symbol: "Best win", pnl: overview.largest_win, date: undefined };
    }
    return wins.reduce<{ symbol: string; pnl: number; date?: string } | null>((best, t) => {
      const pnl = displayPnl(t.pnl, t.fees) ?? 0;
      if (!best || pnl > best.pnl) {
        return { symbol: t.symbol, pnl, date: t.closed_at || t.opened_at };
      }
      return best;
    }, null);
  }, [overview, wins, displayPnl]);

  const worstLoss = useMemo(() => {
    if (overview && overview.largest_loss < 0) {
      const match = losses.find((t) => Math.abs((displayPnl(t.pnl, t.fees) ?? 0) - overview.largest_loss) < 0.01);
      if (match) {
        return {
          symbol: match.symbol,
          pnl: displayPnl(match.pnl, match.fees) ?? overview.largest_loss,
          date: match.closed_at || match.opened_at,
        };
      }
      return { symbol: "Worst loss", pnl: overview.largest_loss, date: undefined };
    }
    return losses.reduce<{ symbol: string; pnl: number; date?: string } | null>((worst, t) => {
      const pnl = displayPnl(t.pnl, t.fees) ?? 0;
      if (!worst || pnl < worst.pnl) {
        return { symbol: t.symbol, pnl, date: t.closed_at || t.opened_at };
      }
      return worst;
    }, null);
  }, [overview, losses, displayPnl]);

  const winStreak = overview?.current_streak_type === "win" ? overview.current_streak : 0;
  const journalStreak = useMemo(
    () =>
      consecutiveJournalStreak(
        [...mood.map((m) => m.date), ...recaps.map((r) => r.date)],
        todayKey
      ),
    [mood, recaps, todayKey]
  );
  const tradingDays = calendar?.days?.filter((d) => d.trades > 0).length ?? overview?.trading_days ?? 0;

  const metrics = buildPerformanceMetrics({
    netPnl: accountNetPnl,
    winRate: accountWinRate,
    profitFactor,
    avgWin: accountAvgWin,
    totalTrades: overview?.total_trades ?? trades.length,
    wins: wins.length,
    losses: losses.length,
    expectancy,
  });

  const loading = accountsLoading || analyticsLoading || (tradesLoading && !!accountId);
  const hasError = analyticsError || tradesError;

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <DashboardHeader
          todaysPnl={todaysPnl}
          ytdPct={ytdPct}
          winRate={accountWinRate}
          profitFactor={profitFactor}
        />

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
              <Skeleton className="h-48" />
            </div>
          ) : hasError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-zinc-300">
              Couldn’t load your trade data. Refresh the page or try again in a moment.
            </div>
          ) : (
            <>
              <PerformanceGrid
                metrics={metrics}
                totalTrades={trades.length}
                equitySeries={equitySeries}
                largestGain={bestWin}
                largestLoss={worstLoss}
                bySetup={analytics?.by_setup ?? []}
                weekDays={weekCalendar?.days ?? []}
              />

              <DailyCheckinCard />

              <DistanceToBreach />

              <MilestonesStrip />

              <StreakCards winStreak={winStreak} journalStreak={journalStreak} tradingDays={tradingDays} />

              <GoalsProgressCard items={goalItems} />

              <MindsetCheckin />

              {todaysTrades.length === 0 ? <EmptyTrades /> : <TodaysTrades trades={todaysTrades} />}
            </>
          )}
          <div className="h-4" />
        </div>
      </div>

      <IntelligencePanel
        overview={overview}
        todaysPnl={todaysPnl}
        todaysTradeCount={todaysTrades.length}
        openCount={openCount}
        todaysWinRate={todaysWinRate}
      />
    </div>
  );
}
