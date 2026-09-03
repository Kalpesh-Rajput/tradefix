/** Mirrors backend/app/services/trade_calc.py so the Add Trade form stays live. */

export type CalcAsset = "stock" | "option" | "future" | "forex" | "crypto";
export type CalcSide = "long" | "short";

export type CalcFill = {
  leg_type: "entry" | "exit";
  quantity: number;
  price: number;
  fees?: number;
};

const LOT_QTY_MAX = 100;
const EPS = 1e-8;

export function normalizeSymbol(symbol?: string | null): string {
  return (symbol || "").toUpperCase().replace(/[/\-\s]/g, "");
}

export function pipSize(symbol: string): number {
  const s = normalizeSymbol(symbol);
  if (s.endsWith("JPY") || s.startsWith("XAU") || s.startsWith("XAG")) return 0.01;
  return 0.0001;
}

export function defaultContractSize(symbol: string): number {
  const s = normalizeSymbol(symbol);
  if (s.startsWith("XAU")) return 100;
  if (s.startsWith("XAG")) return 5000;
  return 100_000;
}

export function quantityToUnits(quantity: number, symbol: string, contractSize?: number | null): number {
  const q = Number(quantity || 0);
  const cs = contractSize && contractSize > 0 ? contractSize : defaultContractSize(symbol);
  if (q > 0 && Math.abs(q) <= LOT_QTY_MAX) return q * cs;
  return q;
}

function isForex(asset: CalcAsset): boolean {
  return asset === "forex";
}

function direction(side: CalcSide): number {
  return side === "long" ? 1 : -1;
}

export function investedAmount(args: {
  assetType: CalcAsset;
  symbol: string;
  quantity: number;
  entryPrice: number;
  leverage?: number | null;
  contractSize?: number | null;
}): number {
  const qty = Number(args.quantity || 0);
  const entry = Number(args.entryPrice || 0);
  if (qty <= 0 || entry <= 0) return 0;
  if (isForex(args.assetType)) {
    const units = quantityToUnits(qty, args.symbol, args.contractSize);
    const lev = args.leverage && args.leverage > 0 ? args.leverage : 1;
    return round2((units * entry) / lev);
  }
  return round2(qty * entry);
}

export function sellAmount(args: {
  assetType: CalcAsset;
  symbol: string;
  quantity: number;
  exitPrice: number;
  leverage?: number | null;
  contractSize?: number | null;
}): number {
  const qty = Number(args.quantity || 0);
  const exitP = Number(args.exitPrice || 0);
  if (qty <= 0 || exitP <= 0) return 0;
  if (isForex(args.assetType)) {
    const units = quantityToUnits(qty, args.symbol, args.contractSize);
    const lev = args.leverage && args.leverage > 0 ? args.leverage : 1;
    return round2((units * exitP) / lev);
  }
  return round2(qty * exitP);
}

export function grossPnl(args: {
  assetType: CalcAsset;
  symbol: string;
  side: CalcSide;
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  contractSize?: number | null;
}): number {
  const qty = Number(args.quantity || 0);
  const entry = Number(args.entryPrice || 0);
  const exitP = Number(args.exitPrice || 0);
  if (qty <= 0 || entry <= 0 || exitP <= 0) return 0;
  const dir = direction(args.side);
  if (!isForex(args.assetType)) return (exitP - entry) * qty * dir;
  const units = quantityToUnits(qty, args.symbol, args.contractSize);
  let raw = (exitP - entry) * units * dir;
  const s = normalizeSymbol(args.symbol);
  const quote = s.length >= 6 ? s.slice(3) : "USD";
  if (quote === "JPY" && exitP) raw = raw / exitP;
  return raw;
}

export function riskFromStop(args: {
  assetType: CalcAsset;
  symbol: string;
  quantity: number;
  entryPrice: number;
  stopLoss?: number | null;
  contractSize?: number | null;
}): number | null {
  if (args.stopLoss == null) return null;
  const sl = Number(args.stopLoss);
  const entry = Number(args.entryPrice || 0);
  const qty = Number(args.quantity || 0);
  if (sl <= 0 || entry <= 0 || qty <= 0) return null;
  const distance = Math.abs(entry - sl);
  if (isForex(args.assetType)) {
    const units = quantityToUnits(qty, args.symbol, args.contractSize);
    const s = normalizeSymbol(args.symbol);
    const quote = s.length >= 6 ? s.slice(3) : "USD";
    let raw = distance * units;
    if (quote === "JPY" && entry) raw = raw / entry;
    return round2(raw);
  }
  return round2(distance * qty);
}

function weightedAvg(pairs: { quantity: number; price: number }[]): number {
  let qty = 0;
  let value = 0;
  for (const row of pairs) {
    const q = Number(row.quantity || 0);
    const p = Number(row.price || 0);
    if (q <= 0 || p <= 0) continue;
    qty += q;
    value += q * p;
  }
  return qty > 0 ? value / qty : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type TradeCalcResult = {
  quantity: number;
  entryPrice: number;
  sellQuantity: number;
  exitPrice: number | null;
  investedAmount: number;
  totalSellAmount: number;
  fees: number;
  pnl: number | null;
  riskAmount: number | null;
  remainingQuantity: number;
  isClose: boolean;
  isProfit: boolean | null;
  status: "open" | "closed";
  year: number;
  month: number;
  isEquity: boolean;
};

export function calculateTrade(args: {
  assetType: CalcAsset;
  symbol: string;
  side: CalcSide;
  openedAt: Date;
  fills?: CalcFill[];
  quantity?: number | null;
  entryPrice?: number | null;
  sellQuantity?: number | null;
  exitPrice?: number | null;
  fees?: number | null;
  stopLoss?: number | null;
  riskAmount?: number | null;
  leverage?: number | null;
  contractSize?: number | null;
}): TradeCalcResult {
  const fills = [...(args.fills ?? [])];
  if (!fills.length && args.quantity && args.entryPrice) {
    fills.push({ leg_type: "entry", quantity: args.quantity, price: args.entryPrice });
    const sellQty = args.sellQuantity ?? (args.exitPrice ? args.quantity : 0);
    if (args.exitPrice && sellQty) {
      fills.push({ leg_type: "exit", quantity: sellQty, price: args.exitPrice, fees: 0 });
    }
  }

  const entries = fills.filter((f) => f.leg_type === "entry" && Number(f.quantity) > 0);
  const exits = fills.filter((f) => f.leg_type === "exit" && Number(f.quantity) > 0);
  const buyQty = round8(entries.reduce((s, f) => s + Number(f.quantity), 0));
  const sellQty = round8(exits.reduce((s, f) => s + Number(f.quantity), 0));
  const avgEntry = weightedAvg(entries);
  const avgExit = exits.length ? weightedAvg(exits) : null;
  let remaining = round8(buyQty - sellQty);
  if (remaining < 0 && remaining > -EPS) remaining = 0;
  const isClose = remaining <= EPS && sellQty > 0;
  const tradeFees = Number(args.fees || 0);
  const legFees = fills.reduce((s, f) => s + Number(f.fees || 0), 0);
  const totalFees = round2(tradeFees + legFees);

  const invested = investedAmount({
    assetType: args.assetType,
    symbol: args.symbol,
    quantity: buyQty,
    entryPrice: avgEntry,
    leverage: args.leverage,
    contractSize: args.contractSize,
  });
  const totalSell = sellAmount({
    assetType: args.assetType,
    symbol: args.symbol,
    quantity: sellQty,
    exitPrice: avgExit || 0,
    leverage: args.leverage,
    contractSize: args.contractSize,
  });

  let pnl: number | null = null;
  if (exits.length && avgEntry > 0) {
    let realized = 0;
    for (const ex of exits) {
      realized += grossPnl({
        assetType: args.assetType,
        symbol: args.symbol,
        side: args.side,
        quantity: Number(ex.quantity),
        entryPrice: avgEntry,
        exitPrice: Number(ex.price),
        contractSize: args.contractSize,
      });
    }
    pnl = round2(realized - totalFees);
  }

  const computedRisk = riskFromStop({
    assetType: args.assetType,
    symbol: args.symbol,
    quantity: buyQty,
    entryPrice: avgEntry,
    stopLoss: args.stopLoss,
    contractSize: args.contractSize,
  });

  return {
    quantity: buyQty,
    entryPrice: avgEntry ? Number(avgEntry.toFixed(6)) : 0,
    sellQuantity: sellQty,
    exitPrice: avgExit ? Number(avgExit.toFixed(6)) : null,
    investedAmount: invested,
    totalSellAmount: totalSell,
    fees: totalFees,
    pnl,
    riskAmount: args.riskAmount != null ? Number(args.riskAmount) : computedRisk,
    remainingQuantity: Math.max(0, remaining),
    isClose,
    isProfit: pnl == null ? null : pnl > 0,
    status: isClose ? "closed" : "open",
    year: args.openedAt.getFullYear(),
    month: args.openedAt.getMonth() + 1,
    isEquity: args.assetType === "stock",
  };
}

function round8(n: number): number {
  return Math.round(n * 1e8) / 1e8;
}
