/** Mirrors backend/app/services/trade_calc.py so the Add Trade form stays live. */

import {
  defaultContractSize,
  defaultLotSize,
  getInstrument,
  normalizeSymbol,
  quoteCurrency,
  resolveForexLookupSymbol,
  type InstrumentSegment,
} from "@/lib/instruments/catalog";

export type CalcAsset = InstrumentSegment;
export type CalcSide = "long" | "short";
export type DisplayStatus = "open" | "partially_closed" | "closed";

export type CalcFill = {
  leg_type: "entry" | "exit";
  quantity: number;
  price: number;
  fees?: number;
};

export type ExitLegBreakdown = {
  quantity: number;
  price: number;
  fees: number;
  gross: number;
  net: number;
};

export type ExitPnlBreakdown = {
  legs: ExitLegBreakdown[];
  totalExited: number;
  averageExitPrice: number | null;
  remaining: number;
  realizedGross: number;
  legFees: number;
  tradeFees: number;
  totalFees: number;
  realizedNet: number | null;
  displayStatus: DisplayStatus;
};

const EPS = 1e-8;

export { normalizeSymbol };

export function pipSize(symbol: string): number {
  const inst = getInstrument("forex", symbol);
  if (inst?.pipSize) return inst.pipSize;
  const s = resolveForexLookupSymbol(symbol);
  if (s.endsWith("JPY") || s.startsWith("XAU") || s.startsWith("XAG")) return 0.01;
  return 0.0001;
}

function direction(side: CalcSide): number {
  return side === "long" ? 1 : -1;
}

function lev(value?: number | null): number {
  if (value == null) return 1;
  return value >= 1 ? value : 1;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round8(n: number): number {
  return Math.round(n * 1e8) / 1e8;
}

export function forexUnits(lots: number, symbol: string, contractSize?: number | null): number {
  const cs = contractSize && contractSize > 0 ? contractSize : defaultContractSize("forex", symbol);
  return Number(lots || 0) * cs;
}

export function quantityToUnits(quantity: number, symbol: string, contractSize?: number | null): number {
  return forexUnits(quantity, symbol, contractSize);
}

export function positionValue(args: {
  assetType: CalcAsset;
  symbol: string;
  quantity: number;
  entryPrice: number;
  contractSize?: number | null;
}): number {
  const qty = Number(args.quantity || 0);
  const entry = Number(args.entryPrice || 0);
  if (qty <= 0 || entry <= 0) return 0;
  if (args.assetType === "forex") return round2(forexUnits(qty, args.symbol, args.contractSize) * entry);
  if (args.assetType === "option") {
    const lot = args.contractSize && args.contractSize > 0 ? args.contractSize : defaultLotSize(args.symbol);
    return round2(qty * lot * entry);
  }
  if (args.assetType === "future") {
    const cs = args.contractSize && args.contractSize > 0 ? args.contractSize : defaultContractSize("future", args.symbol);
    return round2(qty * entry * cs);
  }
  return round2(qty * entry);
}

export function calculateForexMargin(positionSize: number, leverage?: number | null): number {
  if (positionSize <= 0) return 0;
  return round2(positionSize / lev(leverage));
}

export function marginUsed(args: {
  assetType: CalcAsset;
  symbol: string;
  quantity: number;
  entryPrice: number;
  leverage?: number | null;
  contractSize?: number | null;
}): number | null {
  const pos = positionValue(args);
  if (pos <= 0) return null;
  if (args.assetType === "forex") return calculateForexMargin(pos, args.leverage);
  if (args.assetType === "crypto") return round2(pos / lev(args.leverage));
  if (args.assetType === "future") {
    const hint = getInstrument("future", args.symbol)?.marginHint;
    if (hint && hint > 0) return round2(hint * Number(args.quantity || 0));
    return null;
  }
  return null;
}

export function investedAmount(args: {
  assetType: CalcAsset;
  symbol: string;
  quantity: number;
  entryPrice: number;
  leverage?: number | null;
  contractSize?: number | null;
  side?: CalcSide;
}): number {
  const pos = positionValue(args);
  if (args.assetType === "forex") return calculateForexMargin(pos, args.leverage);
  if (args.assetType === "crypto") return round2(pos / lev(args.leverage));
  if (args.assetType === "option") return direction(args.side ?? "long") > 0 ? pos : 0;
  if (args.assetType === "future") {
    const m = marginUsed(args);
    return m ?? pos;
  }
  return pos;
}

export function calculateOptionsValue(contracts: number, lotSize: number | null | undefined, premium: number): number {
  const lot = lotSize && lotSize > 0 ? lotSize : 100;
  return round2(Number(contracts || 0) * lot * Number(premium || 0));
}

export function calculateCryptoPositionValue(quantity: number, entryPrice: number): number {
  return round2(Number(quantity || 0) * Number(entryPrice || 0));
}

export function calculateEquityRisk(args: {
  side: CalcSide;
  quantity: number;
  entryPrice: number;
  stopLoss?: number | null;
}): number | null {
  if (args.stopLoss == null) return null;
  const sl = Number(args.stopLoss);
  const entry = Number(args.entryPrice || 0);
  const qty = Number(args.quantity || 0);
  if (sl < 0 || entry <= 0 || qty <= 0) return null;
  const raw = direction(args.side) > 0 ? (entry - sl) * qty : (sl - entry) * qty;
  return round2(Math.max(0, raw));
}

export function calculateForexRisk(args: {
  side: CalcSide;
  symbol: string;
  lots: number;
  entryPrice: number;
  stopLoss?: number | null;
  contractSize?: number | null;
}): number | null {
  if (args.stopLoss == null) return null;
  const sl = Number(args.stopLoss);
  const entry = Number(args.entryPrice || 0);
  const qty = Number(args.lots || 0);
  if (sl < 0 || entry <= 0 || qty <= 0) return null;
  const distance = direction(args.side) > 0 ? entry - sl : sl - entry;
  if (distance <= 0) return 0;
  let raw = distance * forexUnits(qty, args.symbol, args.contractSize);
  if (quoteCurrency(args.symbol) !== "USD" && entry) raw = raw / entry;
  return round2(raw);
}

export function calculateFuturesRisk(args: {
  side: CalcSide;
  contracts: number;
  entryPrice: number;
  stopLoss?: number | null;
  contractSize?: number | null;
  tickSize?: number | null;
  tickValue?: number | null;
  symbol?: string;
}): number | null {
  if (args.stopLoss == null) return null;
  const sl = Number(args.stopLoss);
  const entry = Number(args.entryPrice || 0);
  const qty = Number(args.contracts || 0);
  if (sl < 0 || entry <= 0 || qty <= 0) return null;
  const distance = direction(args.side) > 0 ? entry - sl : sl - entry;
  if (distance <= 0) return 0;
  const ts = args.tickSize && args.tickSize > 0 ? args.tickSize : 0;
  const tv = args.tickValue && args.tickValue > 0 ? args.tickValue : 0;
  if (ts > 0 && tv > 0) return round2((distance / ts) * tv * qty);
  const cs = args.contractSize && args.contractSize > 0 ? args.contractSize : defaultContractSize("future", args.symbol);
  return round2(distance * qty * cs);
}

export function riskFromStop(args: {
  assetType: CalcAsset;
  symbol: string;
  quantity: number;
  entryPrice: number;
  stopLoss?: number | null;
  contractSize?: number | null;
  side?: CalcSide;
  tickSize?: number | null;
  tickValue?: number | null;
}): number | null {
  if (args.stopLoss == null) return null;
  const side = args.side ?? "long";
  if (args.assetType === "forex") {
    return calculateForexRisk({
      side,
      symbol: args.symbol,
      lots: args.quantity,
      entryPrice: args.entryPrice,
      stopLoss: args.stopLoss,
      contractSize: args.contractSize,
    });
  }
  if (args.assetType === "future") {
    return calculateFuturesRisk({
      side,
      contracts: args.quantity,
      entryPrice: args.entryPrice,
      stopLoss: args.stopLoss,
      contractSize: args.contractSize,
      tickSize: args.tickSize,
      tickValue: args.tickValue,
      symbol: args.symbol,
    });
  }
  if (args.assetType === "option") {
    const lot = args.contractSize && args.contractSize > 0 ? args.contractSize : defaultLotSize(args.symbol);
    const base = calculateEquityRisk({
      side,
      quantity: args.quantity,
      entryPrice: args.entryPrice,
      stopLoss: args.stopLoss,
    });
    return base == null ? null : round2(base * lot);
  }
  return calculateEquityRisk({
    side,
    quantity: args.quantity,
    entryPrice: args.entryPrice,
    stopLoss: args.stopLoss,
  });
}

export function calculateExitPnl(args: {
  assetType: CalcAsset;
  symbol: string;
  side: CalcSide;
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  contractSize?: number | null;
}): number {
  return grossPnl(args);
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
  if (args.assetType === "forex") {
    let raw = (exitP - entry) * forexUnits(qty, args.symbol, args.contractSize) * dir;
    if (quoteCurrency(args.symbol) !== "USD" && exitP) raw = raw / exitP;
    return raw;
  }
  if (args.assetType === "option") {
    const lot = args.contractSize && args.contractSize > 0 ? args.contractSize : defaultLotSize(args.symbol);
    return (exitP - entry) * qty * lot * dir;
  }
  if (args.assetType === "future") {
    const cs = args.contractSize && args.contractSize > 0 ? args.contractSize : defaultContractSize("future", args.symbol);
    return (exitP - entry) * qty * cs * dir;
  }
  return (exitP - entry) * qty * dir;
}

export function sellAmount(args: {
  assetType: CalcAsset;
  symbol: string;
  quantity: number;
  exitPrice: number;
  contractSize?: number | null;
}): number {
  return positionValue({
    assetType: args.assetType,
    symbol: args.symbol,
    quantity: args.quantity,
    entryPrice: args.exitPrice,
    contractSize: args.contractSize,
  });
}

export function displayStatus(remaining: number, sellQty: number): DisplayStatus {
  if (sellQty <= EPS) return "open";
  if (remaining > EPS) return "partially_closed";
  return "closed";
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

export function calculateExitPnlBreakdown(args: {
  assetType: CalcAsset;
  symbol: string;
  side: CalcSide;
  entryQuantity: number;
  entryPrice: number;
  exits: Array<{ quantity: number; price: number; fees?: number }>;
  tradeFees?: number;
  contractSize?: number | null;
}): ExitPnlBreakdown {
  const buyQty = Number(args.entryQuantity || 0);
  const avgEntry = Number(args.entryPrice || 0);
  const legs: ExitLegBreakdown[] = [];
  let realizedGross = 0;
  let legFeesTotal = 0;
  let sellQty = 0;
  const exitPairs: { quantity: number; price: number }[] = [];

  for (const item of args.exits) {
    const qty = Number(item.quantity || 0);
    const price = Number(item.price || 0);
    const fee = Number(item.fees || 0);
    if (qty <= 0 || price <= 0) continue;
    const gross = calculateExitPnl({
      assetType: args.assetType,
      symbol: args.symbol,
      side: args.side,
      quantity: qty,
      entryPrice: avgEntry,
      exitPrice: price,
      contractSize: args.contractSize,
    });
    legs.push({ quantity: qty, price, fees: fee, gross, net: round2(gross - fee) });
    realizedGross += gross;
    legFeesTotal += fee;
    sellQty += qty;
    exitPairs.push({ quantity: qty, price });
  }

  sellQty = round8(sellQty);
  let remaining = round8(buyQty - sellQty);
  if (remaining < 0 && remaining > -EPS) remaining = 0;
  const shown = displayStatus(remaining, sellQty);
  const tradeFeeAmt = Number(args.tradeFees || 0);
  const totalFees = round2(tradeFeeAmt + legFeesTotal);
  const avgExit = exitPairs.length ? weightedAvg(exitPairs) : null;
  return {
    legs,
    totalExited: sellQty,
    averageExitPrice: avgExit != null ? Number(avgExit.toFixed(6)) : null,
    remaining: Math.max(0, remaining),
    realizedGross: legs.length ? round2(realizedGross) : 0,
    legFees: round2(legFeesTotal),
    tradeFees: round2(tradeFeeAmt),
    totalFees,
    realizedNet: legs.length ? round2(realizedGross - totalFees) : null,
    displayStatus: shown,
  };
}

export type TradeCalcResult = {
  quantity: number;
  entryPrice: number;
  sellQuantity: number;
  exitPrice: number | null;
  investedAmount: number;
  positionValue: number;
  marginUsed: number | null;
  premiumReceived: number | null;
  totalSellAmount: number;
  fees: number;
  pnl: number | null;
  riskAmount: number | null;
  remainingQuantity: number;
  isClose: boolean;
  isProfit: boolean | null;
  status: "open" | "closed";
  displayStatus: DisplayStatus;
  year: number;
  month: number;
  isEquity: boolean;
  exitLegs: ExitLegBreakdown[];
  realizedGross: number | null;
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
  tickSize?: number | null;
  tickValue?: number | null;
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
  const shown = displayStatus(remaining, sellQty);
  const isClose = shown === "closed";
  const tradeFees = Number(args.fees || 0);
  const legFees = fills.reduce((s, f) => s + Number(f.fees || 0), 0);
  const totalFees = round2(tradeFees + legFees);

  const pos = positionValue({
    assetType: args.assetType,
    symbol: args.symbol,
    quantity: buyQty,
    entryPrice: avgEntry,
    contractSize: args.contractSize,
  });
  const margin = marginUsed({
    assetType: args.assetType,
    symbol: args.symbol,
    quantity: buyQty,
    entryPrice: avgEntry,
    leverage: args.leverage,
    contractSize: args.contractSize,
  });
  const invested = investedAmount({
    assetType: args.assetType,
    symbol: args.symbol,
    quantity: buyQty,
    entryPrice: avgEntry,
    leverage: args.leverage,
    contractSize: args.contractSize,
    side: args.side,
  });
  const premiumReceived = args.assetType === "option" && args.side === "short" ? pos : null;
  const totalSell = sellAmount({
    assetType: args.assetType,
    symbol: args.symbol,
    quantity: sellQty,
    exitPrice: avgExit || 0,
    contractSize: args.contractSize,
  });

  let pnl: number | null = null;
  const breakdown = calculateExitPnlBreakdown({
    assetType: args.assetType,
    symbol: args.symbol,
    side: args.side,
    entryQuantity: buyQty,
    entryPrice: avgEntry,
    exits,
    tradeFees,
    contractSize: args.contractSize,
  });
  if (exits.length && avgEntry > 0) {
    pnl = round2(breakdown.realizedGross - totalFees);
  }

  const computedRisk = riskFromStop({
    assetType: args.assetType,
    symbol: args.symbol,
    quantity: buyQty,
    entryPrice: avgEntry,
    stopLoss: args.stopLoss,
    contractSize: args.contractSize,
    side: args.side,
    tickSize: args.tickSize,
    tickValue: args.tickValue,
  });

  return {
    quantity: buyQty,
    entryPrice: avgEntry ? Number(avgEntry.toFixed(6)) : 0,
    sellQuantity: sellQty,
    exitPrice: avgExit ? Number(avgExit.toFixed(6)) : null,
    investedAmount: invested,
    positionValue: pos,
    marginUsed: margin,
    premiumReceived,
    totalSellAmount: totalSell,
    fees: totalFees,
    pnl,
    riskAmount: args.riskAmount != null ? Number(args.riskAmount) : computedRisk,
    remainingQuantity: Math.max(0, remaining),
    isClose,
    isProfit: pnl == null ? null : pnl > 0,
    status: isClose ? "closed" : "open",
    displayStatus: shown,
    year: args.openedAt.getFullYear(),
    month: args.openedAt.getMonth() + 1,
    isEquity: args.assetType === "stock",
    exitLegs: breakdown.legs,
    realizedGross: exits.length ? breakdown.realizedGross : null,
  };
}
