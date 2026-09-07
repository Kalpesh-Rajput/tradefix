import type { Trade } from "@/lib/types";

export type TradeViewKpiStats = {
  netPnl: number;
  series: number[];
  profitFactor: number | null;
  grossWins: number;
  grossLosses: number;
  winRate: number | null;
  wins: number;
  losses: number;
  breakeven: number;
  avgWin: number;
  avgLoss: number;
  avgWinLossRatio: number | null;
};

type DisplayPnl = (pnl: number | null, fees?: number) => number | null;

function closedWithPnl(trades: Trade[], displayPnl?: DisplayPnl): { trade: Trade; pnl: number }[] {
  const out: { trade: Trade; pnl: number }[] = [];
  for (const t of trades) {
    if (t.status !== "closed") continue;
    const pnl = displayPnl ? displayPnl(t.pnl, t.fees) : t.pnl;
    if (pnl == null) continue;
    out.push({ trade: t, pnl });
  }
  return out;
}

export function computeTradeViewKpis(trades: Trade[], displayPnl?: DisplayPnl): TradeViewKpiStats {
  const closed = closedWithPnl(trades, displayPnl);
  const chronological = [...closed].sort((a, b) => {
    const aTime = new Date(a.trade.closed_at || a.trade.opened_at).getTime();
    const bTime = new Date(b.trade.closed_at || b.trade.opened_at).getTime();
    return aTime - bTime;
  });

  const series: number[] = [];
  let running = 0;
  for (const row of chronological) {
    running += row.pnl;
    series.push(running);
  }

  const winsList = closed.filter((t) => t.pnl > 0);
  const lossesList = closed.filter((t) => t.pnl < 0);
  const breakeven = closed.filter((t) => t.pnl === 0).length;
  const grossWins = winsList.reduce((sum, t) => sum + t.pnl, 0);
  const grossLosses = Math.abs(lossesList.reduce((sum, t) => sum + t.pnl, 0));
  const profitFactor = grossLosses > 0 ? grossWins / grossLosses : null;
  const winRate = closed.length ? (winsList.length / closed.length) * 100 : null;
  const avgWin = winsList.length ? winsList.reduce((sum, t) => sum + t.pnl, 0) / winsList.length : 0;
  const avgLoss = lossesList.length
    ? Math.abs(lossesList.reduce((sum, t) => sum + t.pnl, 0) / lossesList.length)
    : 0;

  return {
    netPnl: running,
    series,
    profitFactor,
    grossWins,
    grossLosses,
    winRate,
    wins: winsList.length,
    losses: lossesList.length,
    breakeven,
    avgWin,
    avgLoss,
    avgWinLossRatio: avgLoss > 0 ? avgWin / avgLoss : null,
  };
}
