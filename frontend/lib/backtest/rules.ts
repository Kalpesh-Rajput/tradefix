/** Instrument math shared with the Python rules (backtesting/03 section 4). */

export type Side = "buy" | "sell";
export type OrderKind = "market" | "limit" | "stop";

export type Instrument = {
  symbol: string;
  assetClass: string;
  pipSize: number;
  contractSize: number;
  quoteCurrency: string;
  priceDecimals: number;
};

export type Costs = {
  spreadPips: number;
  commissionPerLot: number;
  slippagePips: number;
};

export type Bar = { time: number; open: number; high: number; low: number; close: number };

export type OrderRequest = {
  id: string;
  side: Side;
  kind: OrderKind;
  size: number;
  price: number | null;
  sl: number | null;
  tp: number | null;
};

export function unitsFor(size: number, instrument: Instrument): number {
  return instrument.assetClass === "crypto" ? size : size * instrument.contractSize;
}

export function direction(side: Side): number {
  return side === "buy" ? 1 : -1;
}

export function worse(raw: number, side: Side, pip: number, costs: Costs, slipped: boolean): number {
  const half = (costs.spreadPips * pip) / 2;
  const slip = slipped ? costs.slippagePips * pip : 0;
  return side === "buy" ? raw + half + slip : raw - half - slip;
}

export function pips(side: Side, entry: number, exitPrice: number, pip: number): number {
  return (direction(side) * (exitPrice - entry)) / pip;
}

export function rMultiple(side: Side, entry: number, exitPrice: number, sl: number | null): number | null {
  if (sl == null) return null;
  const risk = direction(side) * (entry - sl);
  if (risk <= 0) return null;
  return (direction(side) * (exitPrice - entry)) / risk;
}

export function quoteIsAccount(quote: string, account: string): boolean {
  const usd = new Set(["USD", "USDT"]);
  return quote === account || (usd.has(quote) && usd.has(account));
}

export function triggerPrice(order: OrderRequest, bar: Bar): number | null {
  const level = order.price;
  if (level == null) return null;
  if (order.side === "buy" && order.kind === "limit" && bar.low <= level) return bar.open <= level ? bar.open : level;
  if (order.side === "sell" && order.kind === "limit" && bar.high >= level) return bar.open >= level ? bar.open : level;
  if (order.side === "buy" && order.kind === "stop" && bar.high >= level) return bar.open >= level ? bar.open : level;
  if (order.side === "sell" && order.kind === "stop" && bar.low <= level) return bar.open <= level ? bar.open : level;
  return null;
}
