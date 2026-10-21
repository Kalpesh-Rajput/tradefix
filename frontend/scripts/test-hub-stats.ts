import assert from "node:assert/strict";

import { pairLabel, summarizeSessions } from "../lib/backtest/hubStats";
import type { SessionSummary } from "../lib/backtest/sessions";

function row(over: Partial<SessionSummary>): SessionSummary {
  return {
    id: "x",
    symbol: "EURUSD",
    timeframe: "15m",
    status: "active",
    start_ms: 0,
    end_ms: null,
    cursor_ms: 0,
    initial_balance: 10000,
    balance: 10000,
    currency: "USD",
    trade_count: 0,
    net_profit: 0,
    updated_at: null,
    ...over,
  };
}

assert.deepEqual(summarizeSessions([]), { sessions: 0, active: 0, trades: 0, net: null });

const mixed = summarizeSessions([
  row({ trade_count: 2, net_profit: 10.1 }),
  row({ status: "finished", trade_count: 3, net_profit: -4.05 }),
]);
assert.equal(mixed.sessions, 2);
assert.equal(mixed.active, 1);
assert.equal(mixed.trades, 5);
assert.deepEqual(mixed.net, { amount: 6.05, currency: "USD" });

assert.equal(summarizeSessions([row({}), row({ currency: "EUR" })]).net, null);

assert.equal(pairLabel("EURUSD"), "EUR/USD");
assert.equal(pairLabel("XAUUSD"), "XAU/USD");
assert.equal(pairLabel("US30"), "US30");

console.log("hub stats checks passed");
