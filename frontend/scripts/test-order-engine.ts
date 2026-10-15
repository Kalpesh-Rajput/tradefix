/**
 * Order engine against the shared scenarios, plus a seeded in-range fill check.
 * Run: npx --yes tsx scripts/test-order-engine.ts
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { OrderEngine, type Action } from "../lib/backtest/orderEngine";
import { mulberry32, randomInt, seedFrom, type Rng } from "../lib/backtest/rng";
import { scenarioFile, type ScenarioCase, type ScenarioFile } from "../lib/backtest/scenarioSchema";
import { summarize } from "../lib/backtest/stats";
import type { Bar, Costs, Instrument, OrderRequest } from "../lib/backtest/rules";

const dir = join(__dirname, "..", "..", "backend", "fixtures", "backtesting", "scenarios");

function instrumentOf(raw: ScenarioCase["instrument"]): Instrument {
  return {
    symbol: raw.symbol,
    assetClass: raw.asset_class,
    pipSize: raw.pip_size,
    contractSize: raw.contract_size,
    quoteCurrency: raw.quote_currency,
    priceDecimals: raw.price_decimals,
  };
}

function costsOf(raw: ScenarioCase["costs"]): Costs {
  return {
    spreadPips: raw?.spread_pips ?? 0,
    commissionPerLot: raw?.commission_per_lot ?? 0,
    slippagePips: raw?.slippage_pips ?? 0,
  };
}

function actionsOf(scenarioCase: ScenarioCase): Action[] {
  return (scenarioCase.actions ?? []).map((action) => ({
    at: action.at,
    type: action.type,
    orderId: action.order_id,
    order: action.order
      ? ({
          id: action.order.id,
          side: action.order.side,
          kind: action.order.kind,
          size: action.order.size,
          price: action.order.price ?? null,
          sl: action.order.sl ?? null,
          tp: action.order.tp ?? null,
        } satisfies OrderRequest)
      : undefined,
  }));
}

function casesOf(file: ScenarioFile): ScenarioCase[] {
  if (file.cases?.length) return file.cases;
  if (!file.instrument || !file.candles || !file.expected) throw new Error(`scenario ${file.id} is incomplete`);
  return [
    {
      name: file.id,
      instrument: file.instrument,
      costs: file.costs,
      account_currency: file.account_currency,
      initial_balance: file.initial_balance,
      conversion_rate: file.conversion_rate,
      close_at_end: file.close_at_end,
      candles: file.candles,
      actions: file.actions,
      expected: file.expected,
      seed: file.seed,
    },
  ];
}

function near(actual: number, expected: number, tolerance: number) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} vs ${expected} (tol ${tolerance})`);
}

const files = readdirSync(dir).filter((name) => name.endsWith(".json")).sort();
const orderFiles = files.filter((name) => {
  const raw = JSON.parse(readFileSync(join(dir, name), "utf8")) as { mode?: string; engines?: string[] };
  return raw.mode !== "strategy" && (raw.engines == null || raw.engines.includes("typescript"));
});
assert.deepEqual(
  orderFiles.map((name) => name.slice(0, 2)),
  ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"]
);

for (const name of orderFiles) {
  const parsed = scenarioFile.safeParse(JSON.parse(readFileSync(join(dir, name), "utf8")));
  assert.equal(parsed.success, true, parsed.success ? "" : parsed.error.message);
  if (!parsed.success) continue;
  const file = parsed.data;
  const tol = {
    price: file.tolerance?.price ?? 1e-8,
    pips: file.tolerance?.pips ?? 1e-6,
    r: file.tolerance?.r ?? 1e-6,
    money: file.tolerance?.money ?? 0.005,
  };
  for (const scenarioCase of casesOf(file)) {
    const bars: Bar[] = scenarioCase.candles;
    const result = new OrderEngine({
      instrument: instrumentOf(scenarioCase.instrument),
      costs: costsOf(scenarioCase.costs),
      accountCurrency: scenarioCase.account_currency,
      initialBalance: scenarioCase.initial_balance,
      conversionRate: scenarioCase.conversion_rate,
      closeAtEnd: scenarioCase.close_at_end,
    }).run(bars, actionsOf(scenarioCase));
    assert.equal(result.fills.length, scenarioCase.expected.fills.length, `${scenarioCase.name} fills`);
    result.fills.forEach((fill, index) => {
      const want = scenarioCase.expected.fills[index];
      assert.equal(fill.orderId, want.order_id);
      assert.equal(fill.time, want.time);
      assert.equal(fill.reason, want.reason);
      near(fill.price, want.price, tol.price);
      const bar = bars.find((item) => item.time === fill.time);
      assert.ok(bar && fill.rawPrice >= bar.low - tol.price && fill.rawPrice <= bar.high + tol.price);
    });
    assert.equal(result.trades.length, scenarioCase.expected.trades.length, scenarioCase.name);
    result.trades.forEach((trade, index) => {
      const want = scenarioCase.expected.trades[index];
      assert.equal(trade.exitReason, want.exit_reason);
      assert.equal(trade.pnlCurrency, want.pnl_currency);
      near(trade.pips, want.pips, tol.pips);
      near(trade.pnl, want.pnl, tol.money);
      if (want.r_multiple == null) assert.equal(trade.rMultiple, null);
      else near(trade.rMultiple ?? NaN, want.r_multiple, tol.r);
    });
    assert.deepEqual(result.warnings, scenarioCase.expected.warnings ?? []);
    if (scenarioCase.expected.stats) {
      const stats = summarize(result.trades);
      assert.equal(stats.tradeCount, scenarioCase.expected.stats.trade_count);
      assert.equal(stats.wins, scenarioCase.expected.stats.wins);
      near(stats.netProfit, scenarioCase.expected.stats.net_profit, tol.money);
    }
  }
}

const malformed = scenarioFile.safeParse({ id: "x", description: "bad", surprise: true });
assert.equal(malformed.success, false, "zod rejects an unknown field");

function randomBars(rng: Rng, count: number): Bar[] {
  const bars: Bar[] = [];
  let price = 1.1;
  for (let i = 0; i < count; i += 1) {
    const open = price;
    const close = Math.round((open + (rng() - 0.5) * 0.004) * 1e5) / 1e5;
    const high = Math.max(open, close) + randomInt(rng, 0, 20) / 1e5;
    const low = Math.min(open, close) - randomInt(rng, 0, 20) / 1e5;
    bars.push({ time: i * 60_000, open, high, low, close });
    price = close;
  }
  return bars;
}

const seed = seedFrom(process.env.BT_SEED, 20261015);
const sequences = process.env.BT_SEED ? 1 : 40;
for (let s = 0; s < sequences; s += 1) {
  const sequenceSeed = (seed + s) >>> 0;
  const rng = mulberry32(sequenceSeed);
  try {
    const bars = randomBars(rng, 24);
    const entry = bars[1].open;
    const side = rng() < 0.5 ? "buy" : "sell";
    const sl = side === "buy" ? entry - 0.003 : entry + 0.003;
    const tp = side === "buy" ? entry + 0.004 : entry - 0.004;
    const result = new OrderEngine({
      instrument: { symbol: "EURUSD", assetClass: "forex", pipSize: 0.0001, contractSize: 100000, quoteCurrency: "USD", priceDecimals: 5 },
      costs: { spreadPips: 0, commissionPerLot: 0, slippagePips: 0 },
    }).run(bars, [{ at: 0, type: "place", order: { id: "p", side, kind: "market", size: 1, price: null, sl, tp } }]);
    for (const fill of result.fills) {
      const bar = bars.find((item) => item.time === fill.time);
      assert.ok(bar, "fill bar");
      assert.ok(fill.rawPrice >= bar!.low && fill.rawPrice <= bar!.high, `raw ${fill.rawPrice} outside ${bar!.low}..${bar!.high}`);
    }
  } catch (error) {
    console.error(`order engine property failed: BT_SEED=${sequenceSeed}`);
    throw error;
  }
}

console.log(`order engine checks passed (10 scenarios, ${sequences} property sequences, seed ${seed})`);
