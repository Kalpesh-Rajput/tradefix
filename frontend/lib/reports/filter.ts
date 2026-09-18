import type { Trade } from "@/lib/types";

/** Matches backend `stats_service._session_for_hour` (UTC hour of opened_at). */
export function sessionForHour(hour: number): string {
  if (hour >= 0 && hour < 7) return "Asia";
  if (hour >= 7 && hour < 12) return "London";
  if (hour >= 12 && hour < 16) return "Overlap";
  if (hour >= 16 && hour < 21) return "NY";
  return "Off";
}

export function tradeSession(trade: Trade): string {
  if (trade.session) return trade.session;
  return sessionForHour(new Date(trade.opened_at).getUTCHours());
}

export function filterReportTrades(
  trades: Trade[],
  opts: {
    dateFrom?: string;
    dateTo?: string;
    session?: string;
    symbol?: string;
    dateKey: (value: Date | string | number) => string;
  }
): Trade[] {
  const symbol = opts.symbol?.trim().toUpperCase();
  return trades.filter((t) => {
    if (t.is_deleted) return false;
    const openDay = opts.dateKey(t.opened_at);
    if (opts.dateFrom && openDay < opts.dateFrom) return false;
    if (opts.dateTo && openDay > opts.dateTo) return false;
    if (symbol && t.symbol.toUpperCase() !== symbol) return false;
    if (opts.session && tradeSession(t) !== opts.session) return false;
    return true;
  });
}
