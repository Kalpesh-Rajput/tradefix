"use client";

import { useMemo } from "react";

import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { EmptyTrades } from "@/components/dashboard/EmptyTrades";
import { IntelligencePanel } from "@/components/dashboard/IntelligencePanel";
import { MindsetCheckin } from "@/components/dashboard/MindsetCheckin";
import { buildPerformanceMetrics, PerformanceGrid } from "@/components/dashboard/PerformanceGrid";
import { StreakCards } from "@/components/dashboard/StreakCards";
import { TodaysTrades } from "@/components/dashboard/TodaysTrades";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAnalytics, useCalendar } from "@/lib/hooks/useAnalytics";
import { useMoodCheckins } from "@/lib/hooks/useMood";
import { useTrades } from "@/lib/hooks/useTrades";

export default function TodayPage() {
  const { data: analytics, isLoading: analyticsLoading } = useAnalytics();
  const { data: trades = [], isLoading: tradesLoading } = useTrades();
  const { data: mood = [] } = useMoodCheckins();

  const monthStart = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  }, []);
  const monthEnd = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const { data: calendar } = useCalendar(monthStart, monthEnd);

  const todayKey = useMemo(() => new Date().toDateString(), []);
  const todaysTrades = useMemo(
    () => trades.filter((t) => new Date(t.opened_at).toDateString() === todayKey),
    [trades, todayKey]
  );
  const todaysPnl = todaysTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);

  const overview = analytics?.overview;
  const closed = trades.filter((t) => t.status === "closed" && t.pnl != null);
  const wins = closed.filter((t) => (t.pnl ?? 0) > 0);
  const losses = closed.filter((t) => (t.pnl ?? 0) < 0);
  const grossWin = wins.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.pnl ?? 0), 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? grossWin : 0;

  const equitySeries = useMemo(() => {
    let sum = 0;
    return [...closed]
      .sort(
        (a, b) =>
          new Date(a.closed_at || a.opened_at).getTime() - new Date(b.closed_at || b.opened_at).getTime()
      )
      .map((t) => {
        sum += t.pnl ?? 0;
        const d = new Date(t.closed_at || t.opened_at);
        return {
          date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          value: sum,
        };
      });
  }, [closed]);

  const bestWin = wins.reduce<(typeof wins)[0] | null>((best, t) => {
    if (!best || (t.pnl ?? 0) > (best.pnl ?? 0)) return t;
    return best;
  }, null);
  const worstLoss = losses.reduce<(typeof losses)[0] | null>((worst, t) => {
    if (!worst || (t.pnl ?? 0) < (worst.pnl ?? 0)) return t;
    return worst;
  }, null);

  const winStreak = overview?.current_streak_type === "win" ? overview.current_streak : 0;
  const journalStreak = mood.length ? Math.min(mood.length, 7) : 0;
  const tradingDays = calendar?.days?.filter((d) => d.trades > 0).length ?? 0;

  const metrics = buildPerformanceMetrics({
    netPnl: overview?.total_pnl ?? 0,
    winRate: overview?.win_rate ?? 0,
    profitFactor,
    avgWin: overview?.avg_win ?? 0,
    totalTrades: overview?.total_trades ?? 0,
    wins: wins.length,
    losses: losses.length,
  });

  const loading = analyticsLoading || tradesLoading;

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header stays fixed; only the body below scrolls */}
        <DashboardHeader
          todaysPnl={todaysPnl}
          ytdPct={0}
          winRate={overview?.win_rate}
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
            </div>
          ) : (
            <>
              {todaysTrades.length === 0 ? <EmptyTrades /> : <TodaysTrades trades={todaysTrades} />}

              <MindsetCheckin />

              <StreakCards winStreak={winStreak} journalStreak={journalStreak} tradingDays={tradingDays} />

              <PerformanceGrid
                metrics={metrics}
                totalTrades={overview?.total_trades ?? 0}
                equitySeries={equitySeries}
                largestGain={
                  bestWin
                    ? { symbol: bestWin.symbol, pnl: bestWin.pnl ?? 0, date: bestWin.closed_at || bestWin.opened_at }
                    : null
                }
                largestLoss={
                  worstLoss
                    ? {
                        symbol: worstLoss.symbol,
                        pnl: worstLoss.pnl ?? 0,
                        date: worstLoss.closed_at || worstLoss.opened_at,
                      }
                    : null
                }
                bySetup={analytics?.by_setup ?? []}
              />
            </>
          )}
          <div className="h-4" />
        </div>
      </div>

      <IntelligencePanel overview={overview} todaysPnl={todaysPnl} />
    </div>
  );
}
