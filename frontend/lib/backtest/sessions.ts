/** Manual-session API types. Times are epoch milliseconds UTC. */

export type SessionStatus = "active" | "finished";

export type SessionSummary = {
  id: string;
  symbol: string;
  timeframe: string;
  status: SessionStatus;
  start_ms: number;
  end_ms: number | null;
  cursor_ms: number;
  initial_balance: number;
  balance: number;
  currency: string;
  trade_count: number;
  net_profit: number;
  updated_at: string | null;
};

export type SessionCreateInput = {
  symbol: string;
  timeframe: string;
  start_ms: number;
  end_ms?: number | null;
  initial_balance: number;
  currency: string;
  spread_pips: number;
  commission_per_lot: number;
  account_id?: string | null;
};

export type MarketInstrument = {
  symbol: string;
  asset_class: string;
  source: string;
  market_type: string;
  pip_size: number;
  contract_size: number;
  quote_currency: string;
  price_decimals: number;
  enabled: boolean;
};

export function formatSessionTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
