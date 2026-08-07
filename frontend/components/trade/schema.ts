import { z } from "zod";

import { BUILTIN_EMOTIONS } from "@/lib/emotions";
import { BUILTIN_MISTAKES, BUILTIN_STRATEGIES } from "@/lib/tradingDefaults";

export const ASSET_OPTIONS = [
  { value: "stock", label: "Equity" },
  { value: "forex", label: "Forex" },
  { value: "crypto", label: "Crypto" },
  { value: "option", label: "Options" },
  { value: "future", label: "Futures" },
] as const;

export const STRATEGIES = BUILTIN_STRATEGIES;
export const MISTAKES = BUILTIN_MISTAKES;
export const EMOTIONS = BUILTIN_EMOTIONS;

export const WENT_WELL = [
  "Followed Plan",
  "Solid Risk/Reward",
  "Patient Entry",
  "Disciplined Exit",
  "Respected Stops",
  "Sized Position Well",
  "Clear Setup",
  "Avoided FOMO",
  "Took Profit as Planned",
  "Good Market Timing",
  "Journaling/Review Helped",
  "Other Positive",
] as const;

export const POPULAR_SYMBOLS = [
  "AAPL",
  "NVDA",
  "TSLA",
  "MSFT",
  "AMZN",
  "META",
  "SPY",
  "QQQ",
  "ES1!",
  "NQ1!",
  "BTCUSD",
  "ETHUSD",
  "EURUSD",
  "GBPUSD",
  "XAUUSD",
];

function num(val: unknown): number | null {
  if (val === "" || val === null || val === undefined) return null;
  const n = typeof val === "number" ? val : Number(val);
  return Number.isFinite(n) ? n : null;
}

export const addTradeSchema = z
  .object({
    asset_type: z.enum(["stock", "option", "future", "forex", "crypto"]),
    symbol: z.string().min(1, "Symbol is required").max(32),
    side: z.enum(["long", "short"]),
    status: z.enum(["open", "closed"]),
    entryDate: z.string().min(1, "Entry date required"),
    entryTime: z.string().min(1, "Entry time required"),
    exitDate: z.string().optional().nullable(),
    exitTime: z.string().optional().nullable(),
    entry_price: z.any(),
    exit_price: z.any().optional().nullable(),
    quantity: z.any(),
    fees: z.any().optional(),
    leverage: z.any().optional().nullable(),
    expiry: z.string().optional().nullable(),
    strategies: z.array(z.string()).default([]),
    emotions: z.array(z.string()).default([]),
    mistakes: z.array(z.string()).default([]),
    wentWell: z.array(z.string()).default([]),
    plan_compliance: z.any().optional().nullable(),
    risk_amount: z.any().optional().nullable(),
    notes: z.string().max(5000).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const entry = num(data.entry_price);
    const qty = num(data.quantity);
    const fees = num(data.fees) ?? 0;
    const exit = num(data.exit_price);
    const risk = num(data.risk_amount);
    const compliance = num(data.plan_compliance);

    if (entry == null || entry <= 0) {
      ctx.addIssue({ code: "custom", message: "Entry price must be > 0", path: ["entry_price"] });
    }
    if (qty == null || qty <= 0) {
      ctx.addIssue({ code: "custom", message: "Contracts must be > 0", path: ["quantity"] });
    }
    if (fees < 0) {
      ctx.addIssue({ code: "custom", message: "Fees cannot be negative", path: ["fees"] });
    }
    if (risk != null && risk < 0) {
      ctx.addIssue({ code: "custom", message: "Risk cannot be negative", path: ["risk_amount"] });
    }
    if (compliance != null && (compliance < 1 || compliance > 10)) {
      ctx.addIssue({
        code: "custom",
        message: "Plan compliance must be 1–10",
        path: ["plan_compliance"],
      });
    }
    if (data.status === "closed") {
      if (exit == null || exit <= 0) {
        ctx.addIssue({ code: "custom", message: "Exit price required for closed trades", path: ["exit_price"] });
      }
      if (!data.exitDate) {
        ctx.addIssue({ code: "custom", message: "Exit date required for closed trades", path: ["exitDate"] });
      }
      if (!data.exitTime) {
        ctx.addIssue({ code: "custom", message: "Exit time required for closed trades", path: ["exitTime"] });
      }
    }
  })
  .transform((data) => ({
    ...data,
    entry_price: num(data.entry_price) ?? 0,
    exit_price: num(data.exit_price),
    quantity: num(data.quantity) ?? 0,
    fees: num(data.fees) ?? 0,
    leverage: num(data.leverage),
    risk_amount: num(data.risk_amount),
    plan_compliance: num(data.plan_compliance),
    expiry: data.expiry || null,
    notes: data.notes || "",
    strategies: data.strategies ?? [],
    emotions: data.emotions ?? [],
    mistakes: data.mistakes ?? [],
    wentWell: data.wentWell ?? [],
  }));

export type AddTradeFormValues = {
  asset_type: "stock" | "option" | "future" | "forex" | "crypto";
  symbol: string;
  side: "long" | "short";
  status: "open" | "closed";
  entryDate: string;
  entryTime: string;
  exitDate?: string | null;
  exitTime?: string | null;
  entry_price: number;
  exit_price?: number | null;
  quantity: number;
  fees: number;
  leverage?: number | null;
  risk_amount?: number | null;
  plan_compliance?: number | null;
  expiry?: string | null;
  strategies: string[];
  emotions: string[];
  mistakes: string[];
  wentWell: string[];
  notes?: string | null;
};

export function defaultAddTradeValues(opts?: {
  defaultFee?: number;
  defaultSymbol?: string | null;
  defaultQuantity?: number | null;
  defaultLeverage?: number | null;
  defaultStrategies?: string[] | null;
}): AddTradeFormValues {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const fee = Math.abs(Number(opts?.defaultFee ?? 0));
  const qty = opts?.defaultQuantity != null && opts.defaultQuantity > 0 ? Number(opts.defaultQuantity) : 1;
  return {
    asset_type: "stock",
    symbol: (opts?.defaultSymbol || "").trim().toUpperCase(),
    side: "long",
    status: "closed",
    entryDate: date,
    entryTime: time,
    exitDate: date,
    exitTime: time,
    entry_price: "" as unknown as number,
    exit_price: "" as unknown as number,
    quantity: qty,
    fees: fee,
    leverage: opts?.defaultLeverage != null && opts.defaultLeverage > 0 ? Number(opts.defaultLeverage) : null,
    risk_amount: null,
    plan_compliance: null,
    expiry: null,
    strategies: [...(opts?.defaultStrategies ?? [])],
    emotions: [],
    mistakes: [],
    wentWell: [],
    notes: "",
  };
}

export function combineDateTime(date?: string | null, time?: string | null): string | null {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function buildNotes(values: AddTradeFormValues): string {
  const parts: string[] = [];
  if (values.notes?.trim()) parts.push(values.notes.trim());
  if (values.wentWell.length) parts.push(`What went well: ${values.wentWell.join(", ")}`);
  if (values.leverage) parts.push(`Leverage: ${values.leverage}x`);
  if (values.expiry) parts.push(`Expiry: ${values.expiry}`);
  return parts.join("\n\n") || "";
}

export function estimatePnl(
  values: Pick<AddTradeFormValues, "side" | "entry_price" | "exit_price" | "quantity" | "fees" | "status">
) {
  if (values.status !== "closed" || values.exit_price == null) return null;
  const direction = values.side === "long" ? 1 : -1;
  const gross = (Number(values.exit_price) - Number(values.entry_price)) * Number(values.quantity) * direction;
  return Math.round((gross - Number(values.fees || 0)) * 100) / 100;
}

export function riskReward(values: Pick<AddTradeFormValues, "entry_price" | "exit_price" | "side">) {
  if (values.exit_price == null || !values.entry_price) return null;
  const move = Math.abs(Number(values.exit_price) - Number(values.entry_price));
  const riskProxy = Number(values.entry_price) * 0.01 || 1;
  return move / riskProxy;
}

export function tradeDurationHours(values: AddTradeFormValues) {
  const open = combineDateTime(values.entryDate, values.entryTime);
  const close = combineDateTime(values.exitDate, values.exitTime);
  if (!open || !close) return null;
  return Math.max(0, (new Date(close).getTime() - new Date(open).getTime()) / 3600000);
}

export function completionPercent(values: AddTradeFormValues) {
  const checks = [
    !!values.symbol,
    Number(values.entry_price) > 0,
    Number(values.quantity) > 0,
    !!values.entryDate && !!values.entryTime,
    values.status === "open" || (!!values.exit_price && !!values.exitDate),
    values.strategies.length > 0,
    !!(values.notes && values.notes.trim().length > 10),
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}
