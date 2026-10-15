import type { ClosedTrade } from "./orderEngine";

export type TradeStats = {
  netProfit: number;
  tradeCount: number;
  wins: number;
  winRate: number;
  profitFactor: number | null;
  expectancyR: number | null;
  averageR: number | null;
};

/** Closed-trade statistics. Trades without a stop are left out of the R figures. */
export function summarize(trades: readonly ClosedTrade[]): TradeStats {
  const wins = trades.filter((trade) => trade.pnl > 0);
  const losses = trades.filter((trade) => trade.pnl < 0);
  const grossProfit = wins.reduce((sum, trade) => sum + trade.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0));
  const rs = trades.map((trade) => trade.rMultiple).filter((value): value is number => value != null);
  const expectancyR = rs.length ? rs.reduce((sum, value) => sum + value, 0) / rs.length : null;
  return {
    netProfit: trades.reduce((sum, trade) => sum + trade.pnl, 0),
    tradeCount: trades.length,
    wins: wins.length,
    winRate: trades.length ? wins.length / trades.length : 0,
    profitFactor: grossLoss === 0 ? (grossProfit > 0 ? null : 0) : grossProfit / grossLoss,
    expectancyR,
    averageR: expectancyR,
  };
}
