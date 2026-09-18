/**
 * Currency converter math, formatting, and freshness tests.
 * Run: npx --yes tsx scripts/test-fx.ts
 */
import {
  isValidCode,
  mergeCurrencies,
  searchCurrencies,
  swapPair,
} from "../lib/fx/catalog";
import {
  convertAmount,
  formatAbsoluteTimestamp,
  formatGroupedAmount,
  formatMoney,
  formatRate,
  formatRelativeTimestamp,
  freshnessLabel,
  invertRate,
  parseAmount,
  roundTo,
  sanitizeAmountInput,
} from "../lib/fx/format";
import { FALLBACK_CURRENCIES } from "../lib/fx/types";

let failed = 0;
let passed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(`FAIL  ${msg}`);
}

function assertEq(actual: unknown, expected: unknown, msg: string) {
  assert(actual === expected, `${msg} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
}

function assertApprox(actual: number, expected: number, msg: string, eps = 1e-9) {
  assert(Math.abs(actual - expected) < eps, `${msg} (expected ~${expected}, got ${actual})`);
}

const USD_INR = 83.42;
const EUR_USD = 1 / 0.92;

assertApprox(convertAmount(1000, USD_INR), 83420, "1. USD → INR 1000");
assertApprox(convertAmount(1000, invertRate(USD_INR)), 1000 / USD_INR, "2. INR → USD 1000");
assertApprox(convertAmount(1000, EUR_USD), 1000 / 0.92, "3. EUR → USD 1000");

const swapped = swapPair("USD", "INR");
assertEq(swapped.base, "INR", "4. swap base");
assertEq(swapped.quote, "USD", "4. swap quote");
assertApprox(convertAmount(1000, USD_INR) * invertRate(USD_INR), 1000, "4. swap inverts conversion");

assertApprox(convertAmount(1000.5, USD_INR), 83461.71, "5. decimal amount");
assertApprox(convertAmount(1_000_000.25, USD_INR), 83.42 * 1_000_000.25, "6. large amount");

assertEq(formatGroupedAmount(1000, 2), "1,000", "7. format 1000");
assertEq(formatGroupedAmount(1000.5, 2), "1,000.50", "7. format 1000.50");
assertEq(formatGroupedAmount(100000, 2), "100,000", "7. format 100000");
assertEq(formatGroupedAmount(1_000_000.25, 2), "1,000,000.25", "7. format 1,000,000.25");
assertEq(formatMoney(1000, "$", 2), "$\u00a01,000", "7. money prefix");
assertEq(sanitizeAmountInput("$1,000.50"), "1000.50", "7. paste with $ and commas");
assertEq(sanitizeAmountInput("abc"), "", "7. letters stripped");
assertEq(parseAmount("1,000.50"), 1000.5, "7. parse grouped");
assert(sanitizeAmountInput("12.34.56") === "12.3456" || sanitizeAmountInput("12.34.56") === null, "7. extra dots sanitized");

assertEq(formatRate(83.42), "83.42", "8. rate USD/INR");
assertEq(formatRate(1.18), "1.18", "8. rate EUR/USD");
assertEq(formatRate(0.56), "0.5600", "8. rate JPY/INR-style");
assertEq(roundTo(12.345, 2), 12.35, "8. round half up");
assertEq(roundTo(83420.004, 2), 83420, "8. high-value rounding");

const rateAt = new Date("2026-09-18T09:47:42.000Z");
const abs = formatAbsoluteTimestamp(rateAt, "Asia/Kolkata", "h12");
assert(abs.includes("2026"), "9. timestamp year");
assert(/Sep/.test(abs), "9. timestamp month");
assert(abs.includes("18"), "9. timestamp day");
assert(abs.includes("IST") || abs.includes("GMT") || abs.includes("India"), "9. timestamp zone");
assertEq(formatRelativeTimestamp(new Date(rateAt.getTime() - 42_000), rateAt), "42 seconds ago", "9. relative 42s");
assertEq(formatRelativeTimestamp(new Date(rateAt.getTime() - 4 * 60_000), rateAt), "4 min ago", "9. relative 4 min");

assertEq(freshnessLabel("cached", true).label, "Cached delayed rate", "10. cached delayed");
assertEq(freshnessLabel("cached", false).label, "Cached rate", "10. cached");
assertEq(freshnessLabel("latest", true).label, "Latest available rate", "10. latest not live");
assertEq(freshnessLabel("stale", true).label, "Showing last available rate", "14. stale label");
assert(!freshnessLabel("latest", true).label.toLowerCase().includes("live"), "10. never says live");

assertEq(isValidCode("USD"), true, "15. valid USD");
assertEq(isValidCode("US"), false, "15. invalid short");
assertEq(isValidCode("ZZZ1"), false, "15. invalid extra");
assertEq(searchCurrencies(FALLBACK_CURRENCIES, "USD")[0]?.code, "USD", "15. search code");
assert(searchCurrencies(FALLBACK_CURRENCIES, "United States").some((c) => c.code === "USD"), "15. search name alias");
assert(searchCurrencies(FALLBACK_CURRENCIES, "$").some((c) => c.code === "USD"), "15. search symbol");
assert(mergeCurrencies([{ code: "XXX", name: "Test", symbol: "X", flag: "XX", decimals: 2 }]).some((c) => c.code === "XXX"), "15. merge unknown ISO");

assertEq(formatGroupedAmount(1234, 0), "1,234", "8. JPY zero decimals");
assert(parseAmount("") == null, "7. empty parse");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
