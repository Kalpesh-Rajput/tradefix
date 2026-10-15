/** Plain-language condition previews and starter templates against the zod strategy schema. */

import { STRATEGY_TEMPLATES, describeCondition, strategySchema } from "../lib/backtest/strategyForm";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const rsi = STRATEGY_TEMPLATES.find((item) => item.id === "rsi-reversion");
const ma = STRATEGY_TEMPLATES.find((item) => item.id === "ma-crossover");
const bands = STRATEGY_TEMPLATES.find((item) => item.id === "bollinger-breakout");
if (!rsi || !ma || !bands) throw new Error("three templates");

assert(
  describeCondition(rsi.definition.long_entry!.conditions[0]) === "RSI(14) crosses below 30",
  describeCondition(rsi.definition.long_entry!.conditions[0]),
);
assert(
  describeCondition(ma.definition.long_entry!.conditions[0]) === "SMA(20) crosses above SMA(50)",
  describeCondition(ma.definition.long_entry!.conditions[0]),
);
assert(
  describeCondition(bands.definition.long_entry!.conditions[0]) === "Close crosses above Bollinger(20) upper",
  describeCondition(bands.definition.long_entry!.conditions[0]),
);

for (const template of STRATEGY_TEMPLATES) {
  const parsed = strategySchema.safeParse(template.definition);
  assert(parsed.success, `${template.id} ${parsed.success ? "" : parsed.error.message}`);
  const sentence = describeCondition(template.definition.long_entry!.conditions[0]);
  assert(sentence.length > 8, sentence);
}

const rejected = strategySchema.safeParse({ ...STRATEGY_TEMPLATES[0].definition, unknown: true });
assert(!rejected.success, "unknown fields are rejected");

console.log("strategy preview ok");
