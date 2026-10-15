import { z } from "zod";

const tolerance = z
  .object({
    price: z.number().default(1e-8),
    pips: z.number().default(1e-6),
    r: z.number().default(1e-6),
    money: z.number().default(0.005),
    ratio: z.number().default(1e-6),
  })
  .strict();

const instrument = z
  .object({
    symbol: z.string(),
    asset_class: z.enum(["forex", "metal", "index", "crypto"]),
    pip_size: z.number().positive(),
    contract_size: z.number().positive(),
    quote_currency: z.string(),
    price_decimals: z.number().int().default(5),
  })
  .strict();

const costs = z
  .object({
    spread_pips: z.number().default(0),
    commission_per_lot: z.number().default(0),
    slippage_pips: z.number().default(0),
  })
  .strict();

const candle = z.object({ time: z.number(), open: z.number(), high: z.number(), low: z.number(), close: z.number() }).strict();

const order = z
  .object({
    id: z.string().min(1),
    side: z.enum(["buy", "sell"]),
    kind: z.enum(["market", "limit", "stop"]),
    size: z.number().positive(),
    price: z.number().nullable().optional(),
    sl: z.number().nullable().optional(),
    tp: z.number().nullable().optional(),
  })
  .strict();

const action = z
  .object({
    at: z.number().int(),
    type: z.enum(["place", "cancel", "close"]),
    order: order.optional(),
    order_id: z.string().optional(),
  })
  .strict();

const expected = z
  .object({
    fills: z.array(z.object({ order_id: z.string(), time: z.number(), price: z.number(), reason: z.string() }).strict()),
    trades: z.array(
      z
        .object({
          id: z.string(),
          side: z.enum(["buy", "sell"]),
          entry_price: z.number(),
          exit_price: z.number(),
          pips: z.number(),
          r_multiple: z.number().nullable(),
          pnl: z.number(),
          pnl_currency: z.string(),
          exit_reason: z.string(),
        })
        .strict()
    ),
    warnings: z.array(z.string()).default([]),
    stats: z
      .object({ net_profit: z.number(), trade_count: z.number(), wins: z.number() })
      .strict()
      .nullable()
      .optional(),
  })
  .strict();

export const scenarioCase = z
  .object({
    name: z.string(),
    instrument,
    costs: costs.optional(),
    account_currency: z.string().optional(),
    initial_balance: z.number().optional(),
    conversion_rate: z.number().nullable().optional(),
    close_at_end: z.enum(["end of data", "session end"]).nullable().optional(),
    candles: z.array(candle).min(1),
    actions: z.array(action).optional(),
    expected,
    seed: z.number().int().nullable().optional(),
  })
  .strict();

export const scenarioFile = z
  .object({
    id: z.string(),
    description: z.string(),
    tolerance: tolerance.optional(),
    seed: z.number().int().nullable().optional(),
    instrument: instrument.optional(),
    costs: costs.optional(),
    account_currency: z.string().optional(),
    initial_balance: z.number().optional(),
    conversion_rate: z.number().nullable().optional(),
    close_at_end: z.enum(["end of data", "session end"]).nullable().optional(),
    candles: z.array(candle).optional(),
    actions: z.array(action).optional(),
    expected: expected.optional(),
    cases: z.array(scenarioCase).optional(),
  })
  .strict();

export type ScenarioFile = z.infer<typeof scenarioFile>;
export type ScenarioCase = z.infer<typeof scenarioCase>;
