/**
 * FE/BE Forex calc parity check.
 * Run: npx --yes tsx scripts/check-forex-parity.ts
 * Compares frontend/lib/tradeCalc.ts against fixtures/forex_calc.json (backend goldens).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { calculateTrade, type CalcFill } from "../lib/tradeCalc";

type FixtureCase = {
  id: string;
  asset_type: "forex";
  symbol: string;
  side: "long" | "short";
  quantity?: number;
  entry_price?: number;
  exit_price?: number;
  sell_quantity?: number;
  leverage?: number;
  fees?: number;
  stop_loss?: number;
  fills?: Array<{ leg_type: "entry" | "exit"; quantity: number; price: number; fees?: number }>;
  expect: Record<string, number | string | null>;
};

type FixtureFile = {
  opened_at: string;
  cases: FixtureCase[];
};

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const data = JSON.parse(readFileSync(join(root, "fixtures", "forex_calc.json"), "utf8")) as FixtureFile;
const openedAt = new Date(data.opened_at);

const keyMap: Record<string, string> = {
  pnl: "pnl",
  position_value: "positionValue",
  margin_used: "marginUsed",
  risk_amount: "riskAmount",
  fees: "fees",
  remaining_quantity: "remainingQuantity",
  display_status: "displayStatus",
  sell_quantity: "sellQuantity",
  exit_price: "exitPrice",
  realized_gross: "realizedGross",
};

let failed = 0;
for (const c of data.cases) {
  const fills: CalcFill[] | undefined = c.fills?.map((f) => ({
    leg_type: f.leg_type,
    quantity: f.quantity,
    price: f.price,
    fees: f.fees ?? 0,
  }));
  const result = calculateTrade({
    assetType: c.asset_type,
    symbol: c.symbol,
    side: c.side,
    openedAt,
    fills,
    quantity: c.quantity,
    entryPrice: c.entry_price,
    exitPrice: c.exit_price,
    sellQuantity: c.sell_quantity,
    fees: c.fees ?? 0,
    leverage: c.leverage,
    stopLoss: c.stop_loss,
  });
  for (const [k, expected] of Object.entries(c.expect)) {
    const prop = keyMap[k] ?? k;
    const actual = (result as Record<string, unknown>)[prop];
    if (actual !== expected) {
      console.error(`FAIL ${c.id}.${k}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      failed += 1;
    }
  }
}

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log(`OK — ${data.cases.length} Forex fixture cases match frontend tradeCalc`);
