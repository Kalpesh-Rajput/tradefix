/**
 * TradeFix Score display helpers.
 * Run: npx --yes tsx scripts/test-tradefix-score.ts
 */
import { scoreBand } from "../lib/tradefix-score/labels";

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

assert(scoreBand(null).label === "No data", "null score is no data, not 0");
assert(scoreBand(12).label === "Developing", "low band");
assert(scoreBand(55).label === "Building", "mid band");
assert(scoreBand(72).label === "Solid", "solid band");
assert(scoreBand(88).label === "Strong", "strong band");
assert(!scoreBand(88).hint.toLowerCase().includes("skill rating"), "no skill-rating copy");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
