/**
 * Replay overlay rules: nothing is drawn before the cursor reaches it.
 * Run: npx --yes tsx scripts/test-replay-overlays.ts
 */
import assert from "node:assert/strict";

import type { ChartTheme } from "../components/chart/chartTheme";
import {
  exitSpan,
  floatingResult,
  overlayLines,
  overlayMarkers,
  priceAt,
  shiftCandle,
  type OverlayTrade,
} from "../components/replay/ReplayOverlays";
import type { Candle } from "../lib/backtest/types";

const theme = { up: "#0a0", down: "#a00", accent: "#44f", text: "#888" } as ChartTheme;
const trade: OverlayTrade = {
  side: "long",
  entryMs: 1_000,
  entryPrice: 100,
  exitMs: 5_000,
  exitPrice: 110,
  stopLoss: 90,
  takeProfit: 120,
};
const candles: Candle[] = [
  { time: 0, open: 100, high: 101, low: 99, close: 100, volume: 1 },
  { time: 1_000, open: 100, high: 104, low: 99, close: 103, volume: 1 },
  { time: 2_000, open: 103, high: 108, low: 102, close: 107, volume: 1 },
];

assert.equal(overlayMarkers(trade, 999, [], theme).length, 0, "before entry nothing is marked");
assert.deepEqual(overlayLines(trade, 999, 0, theme), []);
assert.equal(floatingResult(trade, 999, candles, 1), null);
assert.equal(exitSpan(trade, 4_000), null);

const open = overlayMarkers(trade, 3_000, [{ id: "n", timeMs: 4_000, text: "later" }], theme);
assert.deepEqual(open.map((m) => m.id), ["entry"], "a future note stays hidden");
assert.equal(overlayLines(trade, 3_000, 0, theme).length, 3);
const live = floatingResult(trade, 3_000, candles, 1);
assert.equal(live && live.settled, false);
assert.equal(live && live.pips, 7);
assert.ok(live && live.r != null && Math.abs(live.r - 0.7) < 1e-9);

const done = floatingResult(trade, 5_000, candles, 1);
assert.equal(done && done.settled, true);
assert.equal(done && done.pips, 10);
assert.deepEqual(exitSpan(trade, 5_000), { from: 1_000, to: 5_000 });
assert.ok(overlayMarkers(trade, 5_000, [{ id: "n", timeMs: 4_000, text: "later" }], theme).some((m) => m.id === "note-n"));

const shifted = shiftCandle(candles[1], -2);
assert.equal(shifted.close, 101);
assert.equal(overlayLines(trade, 3_000, -2, theme)[0].price, 98);
assert.equal(priceAt(candles, 1_000), 100, "the candle that starts at the cursor is not visible yet");

console.log("replay overlay checks passed");
