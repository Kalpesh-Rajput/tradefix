import assert from "node:assert/strict";

import { summarizeCoverage } from "../lib/backtest/dataCoverage";
import type { MarketInstrument } from "../lib/backtest/sessions";

function item(over: Partial<MarketInstrument>): MarketInstrument {
  return {
    symbol: "EURUSD",
    asset_class: "forex",
    source: "dukascopy",
    market_type: "spot",
    pip_size: 0.0001,
    contract_size: 100000,
    quote_currency: "USD",
    price_decimals: 5,
    enabled: true,
    data_from_ms: 1_000,
    data_to_ms: 5_000,
    ...over,
  };
}

assert.deepEqual(summarizeCoverage([]), { entries: [], fromMs: null, toMs: null });

const empty = summarizeCoverage([item({ data_from_ms: null }), item({ symbol: "GBPUSD", enabled: false }), item({ symbol: "X", data_to_ms: 1_000 })]);
assert.equal(empty.entries.length, 0);

const mixed = summarizeCoverage([item({ symbol: "USDJPY", data_from_ms: 500, data_to_ms: 9_000 }), item({})]);
assert.deepEqual(mixed.entries.map((entry) => entry.symbol), ["EURUSD", "USDJPY"]);
assert.equal(mixed.fromMs, 500);
assert.equal(mixed.toMs, 9_000);
assert.equal(mixed.entries[1].label, "USD/JPY");

console.log("data coverage ok");
