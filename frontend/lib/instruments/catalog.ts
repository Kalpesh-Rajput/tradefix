/** Segment-aware instrument catalog. Mirrors backend/app/services/instruments.py. */

export type InstrumentSegment = "stock" | "option" | "future" | "forex" | "crypto";

export type Instrument = {
  segment: InstrumentSegment;
  symbol: string;
  display: string;
  contractSize?: number;
  pipSize?: number;
  quote?: string;
  tickSize?: number;
  tickValue?: number;
  lotSize?: number;
  marginHint?: number;
};

export function normalizeSymbol(symbol?: string | null): string {
  return (symbol || "").toUpperCase().replace(/[/\-\s]/g, "");
}

/** Lookup-only aliases — stored trade symbols are left unchanged. */
export const FOREX_SYMBOL_ALIASES: Record<string, string> = {
  GOLD: "XAUUSD",
  XAU: "XAUUSD",
  SILVER: "XAGUSD",
  XAG: "XAGUSD",
};

export function resolveForexLookupSymbol(symbol?: string | null): string {
  const key = normalizeSymbol(symbol);
  return FOREX_SYMBOL_ALIASES[key] ?? key;
}

export const EQUITY_INSTRUMENTS: Instrument[] = [
  { segment: "stock", symbol: "AAPL", display: "AAPL" },
  { segment: "stock", symbol: "MSFT", display: "MSFT" },
  { segment: "stock", symbol: "TSLA", display: "TSLA" },
  { segment: "stock", symbol: "NVDA", display: "NVDA" },
  { segment: "stock", symbol: "AMZN", display: "AMZN" },
  { segment: "stock", symbol: "GOOGL", display: "GOOGL" },
  { segment: "stock", symbol: "META", display: "META" },
  { segment: "stock", symbol: "SPY", display: "SPY" },
  { segment: "stock", symbol: "QQQ", display: "QQQ" },
];

export const FOREX_INSTRUMENTS: Instrument[] = [
  { segment: "forex", symbol: "EURUSD", display: "EUR/USD", contractSize: 100_000, pipSize: 0.0001, quote: "USD" },
  { segment: "forex", symbol: "GBPUSD", display: "GBP/USD", contractSize: 100_000, pipSize: 0.0001, quote: "USD" },
  { segment: "forex", symbol: "USDJPY", display: "USD/JPY", contractSize: 100_000, pipSize: 0.01, quote: "JPY" },
  { segment: "forex", symbol: "USDCHF", display: "USD/CHF", contractSize: 100_000, pipSize: 0.0001, quote: "CHF" },
  { segment: "forex", symbol: "AUDUSD", display: "AUD/USD", contractSize: 100_000, pipSize: 0.0001, quote: "USD" },
  { segment: "forex", symbol: "USDCAD", display: "USD/CAD", contractSize: 100_000, pipSize: 0.0001, quote: "CAD" },
  { segment: "forex", symbol: "NZDUSD", display: "NZD/USD", contractSize: 100_000, pipSize: 0.0001, quote: "USD" },
  { segment: "forex", symbol: "XAUUSD", display: "XAU/USD", contractSize: 100, pipSize: 0.01, quote: "USD" },
  { segment: "forex", symbol: "XAGUSD", display: "XAG/USD", contractSize: 5000, pipSize: 0.01, quote: "USD" },
];

export const CRYPTO_INSTRUMENTS: Instrument[] = [
  { segment: "crypto", symbol: "BTCUSD", display: "BTC/USD" },
  { segment: "crypto", symbol: "ETHUSD", display: "ETH/USD" },
  { segment: "crypto", symbol: "SOLUSD", display: "SOL/USD" },
];

export const OPTIONS_UNDERLYINGS: Instrument[] = [
  { segment: "option", symbol: "AAPL", display: "AAPL", lotSize: 100 },
  { segment: "option", symbol: "MSFT", display: "MSFT", lotSize: 100 },
  { segment: "option", symbol: "TSLA", display: "TSLA", lotSize: 100 },
  { segment: "option", symbol: "NVDA", display: "NVDA", lotSize: 100 },
  { segment: "option", symbol: "SPY", display: "SPY", lotSize: 100 },
  { segment: "option", symbol: "QQQ", display: "QQQ", lotSize: 100 },
];

export const FUTURES_INSTRUMENTS: Instrument[] = [
  { segment: "future", symbol: "ES", display: "ES", contractSize: 50, tickSize: 0.25, tickValue: 12.5, marginHint: 12000 },
  { segment: "future", symbol: "NQ", display: "NQ", contractSize: 20, tickSize: 0.25, tickValue: 5, marginHint: 18000 },
  { segment: "future", symbol: "GC", display: "GC", contractSize: 100, tickSize: 0.1, tickValue: 10, marginHint: 10000 },
  { segment: "future", symbol: "CL", display: "CL", contractSize: 1000, tickSize: 0.01, tickValue: 10, marginHint: 7000 },
];

const CATALOG: Record<InstrumentSegment, Instrument[]> = {
  stock: EQUITY_INSTRUMENTS,
  forex: FOREX_INSTRUMENTS,
  crypto: CRYPTO_INSTRUMENTS,
  option: OPTIONS_UNDERLYINGS,
  future: FUTURES_INSTRUMENTS,
};

export const LEVERAGE_OPTIONS = [1, 5, 10, 20, 30, 50, 100, 200, 500] as const;

export function instrumentsFor(segment: InstrumentSegment): Instrument[] {
  return CATALOG[segment] ?? [];
}

export function symbolsFor(segment: InstrumentSegment): string[] {
  return instrumentsFor(segment).map((item) => item.display);
}

export function getInstrument(segment: InstrumentSegment, symbol?: string | null): Instrument | undefined {
  let key = normalizeSymbol(symbol);
  if (!key) return undefined;
  if (segment === "forex") key = resolveForexLookupSymbol(key);
  return instrumentsFor(segment).find(
    (item) => normalizeSymbol(item.symbol) === key || normalizeSymbol(item.display) === key
  );
}

export function symbolBelongsToSegment(segment: InstrumentSegment, symbol?: string | null): boolean {
  if (!symbol?.trim()) return true;
  const known = instrumentsFor(segment);
  if (!known.length) return true;
  return Boolean(getInstrument(segment, symbol));
}

export function defaultPipSize(symbol?: string | null): number {
  const s = resolveForexLookupSymbol(symbol);
  if (s.endsWith("JPY") || s.startsWith("XAU") || s.startsWith("XAG")) return 0.01;
  return 0.0001;
}

export function defaultContractSize(segment: InstrumentSegment, symbol?: string | null): number {
  const inst = getInstrument(segment, symbol);
  if (inst?.contractSize) return inst.contractSize;
  if (inst?.lotSize) return inst.lotSize;
  if (segment === "forex") {
    const s = resolveForexLookupSymbol(symbol);
    if (s.startsWith("XAU")) return 100;
    if (s.startsWith("XAG")) return 5000;
    return 100_000;
  }
  if (segment === "option") return 100;
  if (segment === "future") return 1;
  return 1;
}

export function defaultLotSize(symbol?: string | null): number {
  return getInstrument("option", symbol)?.lotSize ?? 100;
}

export function quoteCurrency(symbol?: string | null): string {
  const inst = getInstrument("forex", symbol);
  if (inst?.quote) return inst.quote;
  const s = resolveForexLookupSymbol(symbol);
  return s.length >= 6 ? s.slice(3, 6) : "USD";
}

export function qtyLabelFor(segment: InstrumentSegment): string {
  if (segment === "forex") return "Lots";
  if (segment === "option" || segment === "future") return "Contracts";
  return "Quantity";
}

export function isSymbolInOtherSegment(segment: InstrumentSegment, symbol?: string | null): boolean {
  const key = normalizeSymbol(symbol);
  if (!key) return false;
  if (getInstrument(segment, symbol)) return false;
  return (Object.keys(CATALOG) as InstrumentSegment[]).some(
    (other) => other !== segment && Boolean(getInstrument(other, symbol))
  );
}
