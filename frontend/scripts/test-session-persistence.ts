/** Idempotent session batches, retries, and order-ticket sizing. */

import { OrderEngine } from "../lib/backtest/orderEngine";
import { buildBatch, retryDelayMs, sameOrderIds } from "../lib/backtest/sessionPersistence";
import { SessionBook, levelPrice, sizeForRisk } from "../lib/backtest/sessionBook";
import type { Instrument } from "../lib/backtest/rules";

const instrument: Instrument = {
  symbol: "BTCUSDT",
  assetClass: "crypto",
  pipSize: 0.01,
  contractSize: 1,
  quoteCurrency: "USDT",
  priceDecimals: 2,
};

let next = 0;
function ids() {
  next += 1;
  return `ord-${next}`;
}

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const book = SessionBook.create({
  instrument,
  costs: { spreadPips: 0, commissionPerLot: 0, slippagePips: 0 },
  currency: "USD",
  balance: 10_000,
  ids,
});

assert(book.place({ side: "buy", kind: "market", size: 1, price: null, sl: 90, tp: 120, nowMs: 0, mark: 100 }) === null, "market place");
const placed = buildBatch(book.orders, book.view().trades, 0, null);
book.onBar({ time: 60_000, open: 100, high: 101, low: 99, close: 100.5 });
book.onBar({ time: 120_000, open: 100.5, high: 102, low: 100, close: 101 });
const filled = buildBatch(book.orders, book.view().trades, 120_000, null);
assert(sameOrderIds(placed.orders, filled.orders), "order id stays stable after the fill");
assert(filled.orders[0]?.status === "filled", "market filled on the next bar");
assert(filled.orders[0]?.id === "ord-1", "client id");
const again = buildBatch(book.orders, book.view().trades, 120_000, null);
assert(sameOrderIds(again.orders, filled.orders), "a retry uses the same ids");
assert(again.trades.length === filled.trades.length, "trade ids are not duplicated");

assert(retryDelayMs(0, 2) === 2_000, "retry-after wins");
assert(retryDelayMs(1) === 2_000, "backoff");
assert(retryDelayMs(4) === null, "retries stop");

const size = sizeForRisk(10_000, 1, 10, instrument);
assert(size === 10, "1% of 10000 over a 10 point stop is 10 units");
const stop = levelPrice({ side: "buy", role: "sl", mode: "pips", value: 50, reference: 100, pipSize: 0.01, stopDistance: null });
assert(stop === 99.5, "buy stop 50 pips under 100");
const target = levelPrice({ side: "buy", role: "tp", mode: "r", value: 2, reference: 100, pipSize: 0.01, stopDistance: 0.5 });
assert(target === 101, "2R target");

const engine = new OrderEngine({ instrument, costs: { spreadPips: 0, commissionPerLot: 0, slippagePips: 0 }, initialBalance: 1000 });
engine.accept({ at: 0, type: "place", order: { id: "m", side: "buy", kind: "market", size: 1, price: null, sl: 9, tp: null } });
engine.step({ time: 1, open: 10, high: 10, low: 10, close: 10 });
engine.step({ time: 2, open: 11, high: 11, low: 11, close: 11 });
assert(engine.view().position?.entryPrice === 11, "market fills at the next open");

console.log("session persistence checks passed");
