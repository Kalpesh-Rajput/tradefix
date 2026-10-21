import type { SessionSummary } from "./sessions";

export type HubStats = {
  sessions: number;
  active: number;
  trades: number;
  net: { amount: number; currency: string } | null;
};

export function summarizeSessions(rows: readonly SessionSummary[]): HubStats {
  const currencies = new Set(rows.map((row) => row.currency));
  const currency = currencies.size === 1 ? [...currencies][0] : null;
  const amount = rows.reduce((sum, row) => sum + row.net_profit, 0);
  return {
    sessions: rows.length,
    active: rows.filter((row) => row.status === "active").length,
    trades: rows.reduce((sum, row) => sum + row.trade_count, 0),
    net: currency ? { amount: Math.round(amount * 100) / 100, currency } : null,
  };
}

export function pairLabel(symbol: string): string {
  return /^[A-Z]{6}$/.test(symbol) ? `${symbol.slice(0, 3)}/${symbol.slice(3)}` : symbol;
}
