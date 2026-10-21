import { barsBetween } from "./timeMapper";
import type { Anchor, BarLike, Drawing, DrawingContext, FibLevel } from "./types";

export function roundPrice(price: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(price * factor) / factor;
}

export function tickSize(ctx: DrawingContext): number {
  return 10 ** -ctx.priceDecimals;
}

export type FibPrice = { level: FibLevel; price: number };

/**
 * Retracement: level 0 sits at the end price, level 1 at the start, so 0.618 of an up move is 61.8% back down.
 * Extension: levels project the A to B move from C.
 */
export function fibPrices(drawing: Drawing, ctx: DrawingContext): FibPrice[] {
  const levels = (drawing.props.levels ?? []).filter((level) => level.enabled && Number.isFinite(level.value));
  const [a, b, c] = drawing.anchors;
  if (!a || !b) return [];
  if (drawing.tool === "fib_extension") {
    if (!c) return [];
    return levels.map((level) => ({ level, price: roundPrice(c.p + (b.p - a.p) * level.value, ctx.priceDecimals) }));
  }
  return levels.map((level) => ({ level, price: roundPrice(b.p - (b.p - a.p) * level.value, ctx.priceDecimals) }));
}

export type Measure = {
  priceDiff: number;
  percent: number | null;
  ticks: number;
  pips: number | null;
  bars: number;
  elapsedMs: number;
  volume: number | null;
};

export function measure(a: Anchor, b: Anchor, bars: readonly BarLike[], ctx: DrawingContext): Measure {
  const priceDiff = b.p - a.p;
  const inRange = barsBetween(bars, a.t, b.t);
  const withVolume = inRange.filter((bar) => typeof bar.volume === "number" && bar.volume > 0);
  return {
    priceDiff,
    percent: a.p !== 0 ? (priceDiff / Math.abs(a.p)) * 100 : null,
    ticks: Math.round(priceDiff / tickSize(ctx)),
    pips: ctx.pipSize ? priceDiff / ctx.pipSize : null,
    bars: Math.max(0, inRange.length - (inRange.length > 0 ? 1 : 0)),
    elapsedMs: Math.abs(b.t - a.t),
    volume: withVolume.length ? withVolume.reduce((sum, bar) => sum + (bar.volume ?? 0), 0) : null,
  };
}

export type PositionMetrics = {
  side: "long" | "short";
  entry: number;
  stop: number;
  target: number;
  risk: number;
  reward: number;
  ratio: number | null;
  riskPercent: number;
  rewardPercent: number;
  riskTicks: number;
  rewardTicks: number;
  riskPips: number | null;
  rewardPips: number | null;
  bars: number;
  qty: number;
  riskPnl: number | null;
  rewardPnl: number | null;
  pnlCurrency: string | null;
  pnlNote: string | null;
};

function unitsFor(qty: number, ctx: DrawingContext): number | null {
  if (ctx.assetClass === "crypto") return qty;
  return ctx.contractSize ? qty * ctx.contractSize : null;
}

export function positionMetrics(drawing: Drawing, bars: readonly BarLike[], ctx: DrawingContext): PositionMetrics | null {
  const [entry, stop, target] = drawing.anchors;
  if (!entry || !stop || !target) return null;
  const long = drawing.tool === "long_position";
  const dir = long ? 1 : -1;
  const risk = dir * (entry.p - stop.p);
  const reward = dir * (target.p - entry.p);
  const qty = drawing.props.qty ?? 0;
  const units = qty > 0 ? unitsFor(qty, ctx) : null;
  const currency = ctx.quoteCurrency ?? null;
  const sameCurrency = !!currency && !!ctx.accountCurrency && usdLike(currency) === usdLike(ctx.accountCurrency);
  const known = units != null && currency != null && (sameCurrency || !ctx.accountCurrency);
  return {
    side: long ? "long" : "short",
    entry: entry.p,
    stop: stop.p,
    target: target.p,
    risk,
    reward,
    ratio: risk > 0 ? reward / risk : null,
    riskPercent: entry.p !== 0 ? (risk / Math.abs(entry.p)) * 100 : 0,
    rewardPercent: entry.p !== 0 ? (reward / Math.abs(entry.p)) * 100 : 0,
    riskTicks: Math.round(risk / tickSize(ctx)),
    rewardTicks: Math.round(reward / tickSize(ctx)),
    riskPips: ctx.pipSize ? risk / ctx.pipSize : null,
    rewardPips: ctx.pipSize ? reward / ctx.pipSize : null,
    bars: Math.max(0, barsBetween(bars, entry.t, target.t).length - 1),
    qty,
    riskPnl: known ? -risk * units : null,
    rewardPnl: known ? reward * units : null,
    pnlCurrency: known ? currency : null,
    pnlNote: known ? null : qty > 0 && units != null ? `P&L in ${currency ?? "quote currency"} needs conversion` : "Instrument size unknown",
  };
}

function usdLike(code: string): string {
  return code === "USDT" ? "USD" : code;
}

/** Keep stop and target on the correct side of entry and share one right edge. Returns a new anchor list. */
export function normalizePosition(drawing: Drawing, ctx: DrawingContext): Anchor[] {
  const [entry, stop, target] = drawing.anchors;
  if (!entry || !stop || !target) return drawing.anchors;
  const tick = tickSize(ctx);
  const long = drawing.tool === "long_position";
  const edge = Math.max(entry.t + 1, target.t);
  const nextStop = long ? Math.min(stop.p, entry.p - tick) : Math.max(stop.p, entry.p + tick);
  const nextTarget = long ? Math.max(target.p, entry.p + tick) : Math.min(target.p, entry.p - tick);
  return [entry, { t: edge, p: nextStop }, { t: edge, p: nextTarget }];
}

/** Two clicks (entry, target) become entry, mirrored stop and the clicked target. */
export function expandPosition(drawing: Drawing, ctx: DrawingContext): Anchor[] {
  const [entry, second] = drawing.anchors;
  if (!entry || !second) return drawing.anchors;
  const long = drawing.tool === "long_position";
  const tick = tickSize(ctx);
  const distance = Math.max(Math.abs(second.p - entry.p), tick * 10);
  const dir = long ? 1 : -1;
  const edge = second.t > entry.t ? second.t : entry.t + 1;
  return [
    entry,
    { t: edge, p: roundPrice(entry.p - dir * distance, ctx.priceDecimals) },
    { t: edge, p: roundPrice(entry.p + dir * distance, ctx.priceDecimals) },
  ];
}

export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function signed(value: number, decimals: number): string {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(decimals)}`;
}

export function compactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toFixed(abs < 10 ? 2 : 0);
}
