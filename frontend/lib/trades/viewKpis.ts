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

export type OutcomeCardStats = {
  wins: number;
  losses: number;
  winPct: number;
  lossPct: number;
  avgWin: number;
  avgLoss: number;
  /** Running winner count after each closed trade. */
  winCount: number[];
  /** Running loser count after each closed trade. */
  lossCount: number[];
  /** Running average win, updated on each winning trade. */
  avgWinSeries: number[];
  /** Running average loss size, updated on each losing trade. */
  avgLossSeries: number[];
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

function sampleSeries(values: number[], max = 32): number[] {
  if (values.length <= max) return values;
  const out: number[] = [];
  const step = (values.length - 1) / (max - 1);
  for (let index = 0; index < max; index += 1) out.push(values[Math.round(index * step)]);
  return out;
}

export function computeOutcomeCards(trades: Trade[], displayPnl?: DisplayPnl): OutcomeCardStats {
  const chronological = trades
    .flatMap((trade) => {
      const pnl = displayPnl ? displayPnl(trade.pnl, trade.fees) : trade.pnl;
      return pnl == null ? [] : [{ trade, pnl }];
    })
    .sort((a, b) => {
      const aTime = new Date(a.trade.closed_at || a.trade.opened_at).getTime();
      const bTime = new Date(b.trade.closed_at || b.trade.opened_at).getTime();
      return aTime - bTime;
    });

  let wins = 0;
  let losses = 0;
  let flat = 0;
  let winSum = 0;
  let lossSum = 0;
  const winCount: number[] = [];
  const lossCount: number[] = [];
  const avgWinSeries: number[] = [];
  const avgLossSeries: number[] = [];

  for (const row of chronological) {
    if (row.pnl > 0) {
      wins += 1;
      winSum += row.pnl;
      avgWinSeries.push(winSum / wins);
    } else if (row.pnl < 0) {
      losses += 1;
      lossSum += row.pnl;
      avgLossSeries.push(Math.abs(lossSum / losses));
    } else {
      flat += 1;
    }
    winCount.push(wins);
    lossCount.push(losses);
  }

  const rated = wins + losses + flat;
  return {
    wins,
    losses,
    winPct: rated ? (wins / rated) * 100 : 0,
    lossPct: rated ? (losses / rated) * 100 : 0,
    avgWin: wins ? winSum / wins : 0,
    avgLoss: losses ? Math.abs(lossSum / losses) : 0,
    winCount: sampleSeries(winCount),
    lossCount: sampleSeries(lossCount),
    avgWinSeries: sampleSeries(avgWinSeries),
    avgLossSeries: sampleSeries(avgLossSeries),
  };
}
