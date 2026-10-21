/** Manual-session API types. Times are epoch milliseconds UTC. */

export type SessionStatus = "active" | "finished";

export type SessionOrderRow = {
  id: string;
  side: "buy" | "sell";
  order_type: "market" | "limit" | "stop";
  size: number;
  price: number | null;
  sl: number | null;
  tp: number | null;
  status: "pending" | "filled" | "cancelled" | "rejected";
  created_ms: number;
  filled_ms: number | null;
};

export type SessionTradeRow = {
  id: string;
  side: "buy" | "sell";
  size: number;
  entry_ms: number;
  entry_price: number;
  exit_ms: number;
  exit_price: number;
  sl: number | null;
  tp: number | null;
  exit_reason: string;
  commission: number;
  pnl: number;
  pips: number;
  r_multiple: number | null;
  pnl_currency: string;
  discrepancy: boolean;
  notes: string | null;
};

export type SessionDetail = SessionSummary & {
  spread_pips: number;
  commission_per_lot: number;
  notes: string | null;
  warnings: string[];
  orders: SessionOrderRow[];
  trades: SessionTradeRow[];
  stats: {
    net_profit: number;
    trade_count: number;
    wins: number;
    win_rate: number;
    expectancy_r: number | null;
    balance: number;
  };
};

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
  data_from_ms: number | null;
  data_to_ms: number | null;
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
