import { z } from "zod";

export const INDICATORS = ["sma", "ema", "rsi", "macd", "atr", "bollinger", "stochastic", "adx", "highest", "lowest"] as const;
export const OPERATORS = ["gt", "lt", "gte", "lte", "crosses_above", "crosses_below"] as const;
export const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "4h", "1d"] as const;

const OPERATOR_WORDS: Record<(typeof OPERATORS)[number], string> = {
  gt: "is above",
  lt: "is below",
  gte: "is at or above",
  lte: "is at or below",
  crosses_above: "crosses above",
  crosses_below: "crosses below",
};

export type Operand = {
  kind: "price" | "indicator" | "constant";
  field?: "open" | "high" | "low" | "close" | null;
  offset?: number;
  name?: string | null;
  period?: number | null;
  output?: string | null;
  value?: number | null;
};

export type Condition = {
  left: Operand;
  operator: (typeof OPERATORS)[number];
  right: Operand;
};

export type RuleGroup = {
  combine: "all" | "any";
  conditions: Condition[];
  groups: { combine: "all" | "any"; conditions: Condition[] }[];
};

export type StrategyDefinition = {
  schema_version: 1;
  name: string;
  description: string;
  market: { symbol: string; timeframe: (typeof TIMEFRAMES)[number]; start_ms: number; end_ms: number };
  direction: "long" | "short" | "both";
  long_entry: RuleGroup | null;
  short_entry: RuleGroup | null;
  stop_loss: { type: "pips" | "atr" | "percent" | "swing"; value: number; period?: number | null; buffer_pips?: number; min_distance_pips?: number };
  take_profit: { type: "r" | "pips" | "atr"; value: number; period?: number | null };
  max_bars?: number | null;
  exit_on_opposite: boolean;
  filters: { hours: number[]; weekdays: number[]; max_trades_per_day?: number | null; min_bars_between: number };
  risk: { initial_balance: number; risk_percent?: number | null; fixed_size?: number | null; max_size?: number | null };
  costs: { spread_pips: number; commission_per_lot: number; slippage_pips: number };
};

const operandSchema = z
  .object({
    kind: z.enum(["price", "indicator", "constant"]),
    field: z.enum(["open", "high", "low", "close"]).nullable().optional(),
    offset: z.number().int().min(0).max(50).default(0),
    name: z.string().nullable().optional(),
    period: z.number().int().nullable().optional(),
    output: z.string().nullable().optional(),
    value: z.number().nullable().optional(),
  })
  .strict();

const conditionSchema = z
  .object({
    left: operandSchema,
    operator: z.enum(OPERATORS),
    right: operandSchema,
  })
  .strict();

const nestedSchema = z.object({ combine: z.enum(["all", "any"]), conditions: z.array(conditionSchema) }).strict();

const groupSchema = z
  .object({
    combine: z.enum(["all", "any"]),
    conditions: z.array(conditionSchema),
    groups: z.array(nestedSchema).default([]),
  })
  .strict();

export const strategySchema = z
  .object({
    schema_version: z.literal(1),
    name: z.string().min(1).max(80),
    description: z.string().max(2000).default(""),
    market: z
      .object({
        symbol: z.string().min(3).max(32),
        timeframe: z.enum(TIMEFRAMES),
        start_ms: z.number().int().min(0),
        end_ms: z.number().int().min(0),
      })
      .strict(),
    direction: z.enum(["long", "short", "both"]),
    long_entry: groupSchema.nullable().optional(),
    short_entry: groupSchema.nullable().optional(),
    stop_loss: z
      .object({
        type: z.enum(["pips", "atr", "percent", "swing"]),
        value: z.number().positive(),
        period: z.number().int().nullable().optional(),
        buffer_pips: z.number().min(0).default(0),
        min_distance_pips: z.number().min(0).default(0),
      })
      .strict(),
    take_profit: z
      .object({
        type: z.enum(["r", "pips", "atr"]),
        value: z.number().positive(),
        period: z.number().int().nullable().optional(),
      })
      .strict(),
    max_bars: z.number().int().min(1).max(10000).nullable().optional(),
    exit_on_opposite: z.boolean().default(false),
    filters: z
      .object({
        hours: z.array(z.number().int().min(0).max(23)).default([]),
        weekdays: z.array(z.number().int().min(0).max(6)).default([]),
        max_trades_per_day: z.number().int().min(1).nullable().optional(),
        min_bars_between: z.number().int().min(0).default(0),
      })
      .strict()
      .default({ hours: [], weekdays: [], min_bars_between: 0 }),
    risk: z
      .object({
        initial_balance: z.number().positive(),
        risk_percent: z.number().positive().max(100).nullable().optional(),
        fixed_size: z.number().positive().nullable().optional(),
        max_size: z.number().positive().nullable().optional(),
      })
      .strict(),
    costs: z
      .object({
        spread_pips: z.number().min(0).default(0),
        commission_per_lot: z.number().min(0).default(0),
        slippage_pips: z.number().min(0).default(0),
      })
      .strict()
      .default({ spread_pips: 0, commission_per_lot: 0, slippage_pips: 0 }),
  })
  .strict();

const INDICATOR_LABELS: Record<string, string> = {
  sma: "SMA",
  ema: "EMA",
  rsi: "RSI",
  macd: "MACD",
  atr: "ATR",
  bollinger: "Bollinger",
  stochastic: "Stochastic",
  adx: "ADX",
  highest: "Highest",
  lowest: "Lowest",
};

export function describeOperand(operand: Operand): string {
  if (operand.kind === "constant") return String(operand.value ?? "");
  if (operand.kind === "price") {
    const field = operand.field ?? "close";
    const name = field.slice(0, 1).toUpperCase() + field.slice(1);
    return operand.offset ? `${name} ${operand.offset} bars ago` : name;
  }
  const label = INDICATOR_LABELS[operand.name ?? ""] ?? operand.name ?? "Indicator";
  const output = operand.output && operand.output !== "value" ? ` ${operand.output}` : "";
  return `${label}(${operand.period ?? ""})${output}`;
}

export function describeCondition(condition: Condition): string {
  return `${describeOperand(condition.left)} ${OPERATOR_WORDS[condition.operator]} ${describeOperand(condition.right)}`;
}

function price(field: Operand["field"]): Operand {
  return { kind: "price", field, offset: 0 };
}

function indicator(name: string, period: number, output?: string): Operand {
  return { kind: "indicator", name, period, output: output ?? null, offset: 0 };
}

function constant(value: number): Operand {
  return { kind: "constant", value, offset: 0 };
}

function condition(left: Operand, operator: Condition["operator"], right: Operand): Condition {
  return { left, operator, right };
}

const RANGE_START = Date.UTC(2026, 2, 2);
const RANGE_END = Date.UTC(2026, 3, 1);

function shell(name: string, description: string, entry: RuleGroup): StrategyDefinition {
  return {
    schema_version: 1,
    name,
    description,
    market: { symbol: "EURUSD", timeframe: "15m", start_ms: RANGE_START, end_ms: RANGE_END },
    direction: "long",
    long_entry: entry,
    short_entry: null,
    stop_loss: { type: "pips", value: 100, buffer_pips: 0, min_distance_pips: 0 },
    take_profit: { type: "r", value: 2 },
    exit_on_opposite: false,
    filters: { hours: [], weekdays: [], min_bars_between: 0 },
    risk: { initial_balance: 10000, fixed_size: 0.01 },
    costs: { spread_pips: 0.8, commission_per_lot: 0, slippage_pips: 0 },
  };
}

export const STRATEGY_TEMPLATES: { id: string; label: string; blurb: string; definition: StrategyDefinition }[] = [
  {
    id: "ma-crossover",
    label: "Moving-average crossover",
    blurb: "Buy when a fast average crosses above a slow average.",
    definition: shell(
      "MA crossover",
      "Fast SMA crosses above the slow SMA.",
      { combine: "all", conditions: [condition(indicator("sma", 20), "crosses_above", indicator("sma", 50))], groups: [] },
    ),
  },
  {
    id: "rsi-reversion",
    label: "RSI mean reversion",
    blurb: "Buy when RSI crosses back below an oversold level.",
    definition: shell(
      "RSI mean reversion",
      "RSI crosses below 30.",
      { combine: "all", conditions: [condition(indicator("rsi", 14), "crosses_below", constant(30))], groups: [] },
    ),
  },
  {
    id: "bollinger-breakout",
    label: "Bollinger breakout",
    blurb: "Buy when price crosses above the upper band.",
    definition: shell(
      "Bollinger breakout",
      "Close crosses above the upper Bollinger band.",
      { combine: "all", conditions: [condition(price("close"), "crosses_above", indicator("bollinger", 20, "upper"))], groups: [] },
    ),
  },
];

export function blankStrategy(): StrategyDefinition {
  return shell("New strategy", "", {
    combine: "all",
    conditions: [condition(price("close"), "gt", constant(0))],
    groups: [],
  });
}

export function emptyCondition(): Condition {
  return condition(price("close"), "gt", constant(0));
}
