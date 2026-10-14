import type { ChartMarker, ChartPriceLine } from "@/components/chart/chartModel";
import type { ChartTheme } from "@/components/chart/chartTheme";
import type { Candle } from "@/lib/backtest/types";

export type OverlayTrade = {
  side: "long" | "short";
  entryMs: number;
  entryPrice: number;
  exitMs: number | null;
  exitPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
};

export type OverlayNote = { id: string; timeMs: number; text: string };

export type FloatingResult = { pips: number; r: number | null; settled: boolean };

const LINE = { entry: "entry", stop: "stop", target: "target" } as const;

export function shiftCandle(candle: Candle, delta: number): Candle {
  if (!delta) return candle;
  return {
    ...candle,
    open: candle.open + delta,
    high: candle.high + delta,
    low: candle.low + delta,
    close: candle.close + delta,
  };
}

export function shiftCandles(candles: readonly Candle[], delta: number): Candle[] {
  return delta ? candles.map((candle) => shiftCandle(candle, delta)) : [...candles];
}

export function priceAt(candles: readonly Candle[], cursorMs: number): number | null {
  let price: number | null = null;
  for (const candle of candles) {
    if (candle.time >= cursorMs) break;
    price = candle.close;
  }
  return price;
}

export function floatingResult(trade: OverlayTrade, cursorMs: number, candles: readonly Candle[], pipSize: number): FloatingResult | null {
  if (cursorMs < trade.entryMs) return null;
  const settled = trade.exitMs != null && cursorMs >= trade.exitMs && trade.exitPrice != null;
  const price = settled ? trade.exitPrice : priceAt(candles, cursorMs);
  if (price == null || pipSize <= 0) return null;
  const direction = trade.side === "long" ? 1 : -1;
  const move = (price - trade.entryPrice) * direction;
  let r: number | null = null;
  if (trade.stopLoss != null) {
    const risk = (trade.entryPrice - trade.stopLoss) * direction;
    if (risk > 0) r = move / risk;
  }
  return { pips: move / pipSize, r, settled };
}

export function overlayMarkers(trade: OverlayTrade, cursorMs: number, notes: readonly OverlayNote[], theme: ChartTheme): ChartMarker[] {
  const markers: ChartMarker[] = [];
  if (cursorMs >= trade.entryMs) {
    const long = trade.side === "long";
    markers.push({
      id: "entry",
      time: trade.entryMs,
      position: long ? "belowBar" : "aboveBar",
      shape: long ? "arrowUp" : "arrowDown",
      color: long ? theme.up : theme.down,
      text: "Entry",
    });
  }
  if (trade.exitMs != null && cursorMs >= trade.exitMs) {
    const long = trade.side === "long";
    markers.push({
      id: "exit",
      time: trade.exitMs,
      position: long ? "aboveBar" : "belowBar",
      shape: long ? "arrowDown" : "arrowUp",
      color: theme.text,
      text: "Exit",
    });
  }
  for (const note of notes) {
    if (cursorMs < note.timeMs) continue;
    markers.push({
      id: `note-${note.id}`,
      time: note.timeMs,
      position: "aboveBar",
      shape: "circle",
      color: theme.accent,
      text: note.text.length > 24 ? `${note.text.slice(0, 24)}…` : note.text,
    });
  }
  return markers;
}

export function overlayLines(trade: OverlayTrade, cursorMs: number, delta: number, theme: ChartTheme): ChartPriceLine[] {
  if (cursorMs < trade.entryMs) return [];
  const at = (price: number) => price + delta;
  const lines: ChartPriceLine[] = [
    { id: LINE.entry, price: at(trade.entryPrice), color: theme.accent, title: "Entry", style: "solid", width: 1 },
  ];
  if (trade.stopLoss != null) {
    lines.push({ id: LINE.stop, price: at(trade.stopLoss), color: theme.down, title: "Stop", style: "dashed", width: 1 });
  }
  if (trade.takeProfit != null) {
    lines.push({ id: LINE.target, price: at(trade.takeProfit), color: theme.up, title: "Target", style: "dashed", width: 1 });
  }
  return lines;
}

export function exitSpan(trade: OverlayTrade, cursorMs: number): { from: number; to: number } | null {
  if (trade.exitMs == null || cursorMs < trade.exitMs) return null;
  return { from: trade.entryMs, to: trade.exitMs };
}

export const PRICE_LINE_IDS = [LINE.entry, LINE.stop, LINE.target];
