import { z } from "zod";

import { BUILTIN_EMOTIONS } from "@/lib/emotions";
import { defaultContractSize, defaultLotSize, getInstrument } from "@/lib/instruments/catalog";
import { BUILTIN_MISTAKES, BUILTIN_STRATEGIES } from "@/lib/tradingDefaults";
import { calculateTrade, displayStatus } from "@/lib/tradeCalc";
import type { Trade } from "@/lib/types";

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
  "MSFT",
  "TSLA",
  "NVDA",
  "SPY",
  "QQQ",
];

function num(val: unknown): number | null {
  if (val === "" || val === null || val === undefined) return null;
  const n = typeof val === "number" ? val : Number(val);
  return Number.isFinite(n) ? n : null;
}

const fillSchema = z.object({
  quantity: z.any(),
  price: z.any(),
  date: z.string().optional().nullable(),
  time: z.string().optional().nullable(),
  condition: z.string().optional().nullable(),
  fees: z.any().optional().nullable(),
});

export const addTradeSchema = z
  .object({
    asset_type: z.enum(["stock", "option", "future", "forex", "crypto"]),
    symbol: z.string().min(1, "Symbol is required").max(32),
    side: z.enum(["long", "short"]),
    status: z.enum(["open", "closed"]),
    account_id: z.string().optional().nullable(),
    session: z.string().optional().nullable(),
    trade_type: z.string().optional().nullable(),
    option_type: z.string().optional().nullable(),
    analysis_timeframe: z.string().optional().nullable(),
    entry_timeframe: z.string().optional().nullable(),
    entryDate: z.string().min(1, "Entry date required"),
    entryTime: z.string().min(1, "Entry time required"),
    exitDate: z.string().optional().nullable(),
    exitTime: z.string().optional().nullable(),
    entry_price: z.any(),
    exit_price: z.any().optional().nullable(),
    quantity: z.any(),
    fees: z.any().optional(),
    leverage: z.any().optional().nullable(),
    contract_size: z.any().optional().nullable(),
    strike_price: z.any().optional().nullable(),
    expiry_date: z.string().optional().nullable(),
    tick_size: z.any().optional().nullable(),
    tick_value: z.any().optional().nullable(),
    stop_loss: z.any().optional().nullable(),
    entry_condition: z.string().optional().nullable(),
    exit_condition: z.string().optional().nullable(),
    is_favourite: z.boolean().optional().default(false),
    precheck_list_id: z.string().optional().nullable(),
    mood: z.string().optional().nullable(),
    expiry: z.string().optional().nullable(),
    strategies: z.array(z.string()).default([]),
    emotions: z.array(z.string()).default([]),
    mistakes: z.array(z.string()).default([]),
    wentWell: z.array(z.string()).default([]),
    plan_compliance: z.any().optional().nullable(),
    risk_amount: z.any().optional().nullable(),
    notes: z.string().max(5000).optional().nullable(),
    exits: z.array(fillSchema).default([]),
  })
  .superRefine((data, ctx) => {
    const entry = num(data.entry_price);
    const qty = num(data.quantity);
    const fees = num(data.fees) ?? 0;
    const risk = num(data.risk_amount);
    const compliance = num(data.plan_compliance);
    const stop = num(data.stop_loss);

    const qtyMsg =
      data.asset_type === "forex"
        ? "Lots must be > 0"
        : data.asset_type === "option" || data.asset_type === "future"
          ? "Contracts must be > 0"
          : "Quantity must be > 0";
    const priceMsg = data.asset_type === "option" ? "Premium must be > 0" : "Entry price must be > 0";

    if (entry == null || entry <= 0) {
      ctx.addIssue({ code: "custom", message: priceMsg, path: ["entry_price"] });
    }
    if (qty == null || qty <= 0) {
      ctx.addIssue({ code: "custom", message: qtyMsg, path: ["quantity"] });
    }
    if (fees < 0) {
      ctx.addIssue({ code: "custom", message: "Fees cannot be negative", path: ["fees"] });
    }
    if (risk != null && risk < 0) {
      ctx.addIssue({ code: "custom", message: "Risk cannot be negative", path: ["risk_amount"] });
    }
    if (stop != null && stop < 0) {
      ctx.addIssue({ code: "custom", message: "Stop loss cannot be negative", path: ["stop_loss"] });
    }
    const leverage = num(data.leverage);
    if (leverage != null && leverage < 1) {
      ctx.addIssue({ code: "custom", message: "Leverage must be at least 1×", path: ["leverage"] });
    }
    const contractSize = num(data.contract_size);
    if (contractSize != null && contractSize <= 0) {
      ctx.addIssue({ code: "custom", message: "Contract / lot size must be > 0", path: ["contract_size"] });
    }
    const tickSize = num(data.tick_size);
    if (tickSize != null && tickSize <= 0) {
      ctx.addIssue({ code: "custom", message: "Tick size must be > 0", path: ["tick_size"] });
    }
    const tickValue = num(data.tick_value);
    if (tickValue != null && tickValue <= 0) {
      ctx.addIssue({ code: "custom", message: "Tick value must be > 0", path: ["tick_value"] });
    }
    if (data.asset_type === "option") {
      if (!data.option_type) {
        ctx.addIssue({ code: "custom", message: "Call or Put is required", path: ["option_type"] });
      }
      const strike = num(data.strike_price);
      if (strike == null || strike <= 0) {
        ctx.addIssue({ code: "custom", message: "Strike must be > 0", path: ["strike_price"] });
      }
      if (!data.expiry_date && !data.expiry) {
        ctx.addIssue({ code: "custom", message: "Expiry date is required", path: ["expiry_date"] });
      }
    }
    if (entry && stop != null && stop > 0) {
      if (data.side === "long" && stop >= entry) {
        ctx.addIssue({ code: "custom", message: "Long stop loss should be below entry", path: ["stop_loss"] });
      }
      if (data.side === "short" && stop <= entry) {
        ctx.addIssue({ code: "custom", message: "Short stop loss should be above entry", path: ["stop_loss"] });
      }
    }
    if (compliance != null && (compliance < 1 || compliance > 10)) {
      ctx.addIssue({
        code: "custom",
        message: "Plan compliance must be 1–10",
        path: ["plan_compliance"],
      });
    }

    let exitQty = 0;
    (data.exits ?? []).forEach((leg, index) => {
      const lq = num(leg.quantity);
      const lp = num(leg.price);
      const lf = num(leg.fees) ?? 0;
      const exitQtyLabel = data.asset_type === "forex" ? "Exit lots" : "Exit qty";
      if (lq == null || lq <= 0) {
        ctx.addIssue({
          code: "custom",
          message: `${exitQtyLabel} must be > 0`,
          path: ["exits", index, "quantity"],
        });
      } else {
        exitQty += lq;
      }
      if (lp == null || lp <= 0) {
        ctx.addIssue({ code: "custom", message: "Exit price must be > 0", path: ["exits", index, "price"] });
      }
      if (lf < 0) {
        ctx.addIssue({ code: "custom", message: "Fees cannot be negative", path: ["exits", index, "fees"] });
      }
      if (!leg.date) {
        ctx.addIssue({ code: "custom", message: "Exit date required", path: ["exits", index, "date"] });
      }
    });
    if (qty && exitQty - qty > 1e-8) {
      ctx.addIssue({
        code: "custom",
        message:
          data.asset_type === "forex"
            ? "Exit lots cannot exceed entry lots"
            : "Exit quantity cannot exceed entry quantity",
        path: ["exits"],
      });
    }
  })
  .transform((data) => ({
    ...data,
    entry_price: num(data.entry_price) ?? 0,
    exit_price: num(data.exit_price),
    quantity: num(data.quantity) ?? 0,
    fees: num(data.fees) ?? 0,
    leverage: num(data.leverage),
    contract_size: num(data.contract_size),
    strike_price: num(data.strike_price),
    tick_size: num(data.tick_size),
    tick_value: num(data.tick_value),
    stop_loss: num(data.stop_loss),
    risk_amount: num(data.risk_amount),
    plan_compliance: num(data.plan_compliance),
    expiry: data.expiry_date || data.expiry || null,
    expiry_date: data.expiry_date || data.expiry || null,
    notes: data.notes || "",
    strategies: data.strategies ?? [],
    emotions: data.emotions ?? [],
    mistakes: data.mistakes ?? [],
    wentWell: data.wentWell ?? [],
    is_favourite: Boolean(data.is_favourite),
    exits: (data.exits ?? []).map((leg) => ({
      quantity: num(leg.quantity) ?? 0,
      price: num(leg.price) ?? 0,
      date: leg.date || "",
      time: leg.time || "00:00",
      condition: leg.condition || "",
      fees: num(leg.fees) ?? 0,
    })),
  }));

export type ExitFillValues = {
  quantity: number;
  price: number;
  date: string;
  time: string;
  condition?: string | null;
  fees?: number | null;
};

export type AddTradeFormValues = {
  asset_type: "stock" | "option" | "future" | "forex" | "crypto";
  symbol: string;
  side: "long" | "short";
  status: "open" | "closed";
  account_id?: string | null;
  session?: string | null;
  trade_type?: string | null;
  option_type?: string | null;
  analysis_timeframe?: string | null;
  entry_timeframe?: string | null;
  entryDate: string;
  entryTime: string;
  exitDate?: string | null;
  exitTime?: string | null;
  entry_price: number;
  exit_price?: number | null;
  quantity: number;
  fees: number;
  leverage?: number | null;
  contract_size?: number | null;
  strike_price?: number | null;
  expiry_date?: string | null;
  tick_size?: number | null;
  tick_value?: number | null;
  stop_loss?: number | null;
  entry_condition?: string | null;
  exit_condition?: string | null;
  is_favourite?: boolean;
  precheck_list_id?: string | null;
  mood?: string | null;
  risk_amount?: number | null;
  plan_compliance?: number | null;
  expiry?: string | null;
  strategies: string[];
  emotions: string[];
  mistakes: string[];
  wentWell: string[];
  notes?: string | null;
  exits: ExitFillValues[];
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
    status: "open",
    account_id: null,
    session: "",
    trade_type: "Intraday",
    option_type: "",
    analysis_timeframe: "15m",
    entry_timeframe: "5m",
    entryDate: date,
    entryTime: time,
    exitDate: date,
    exitTime: time,
    entry_price: "" as unknown as number,
    exit_price: "" as unknown as number,
    quantity: qty,
    fees: fee,
    leverage: null,
    contract_size: null,
    strike_price: null,
    expiry_date: null,
    tick_size: null,
    tick_value: null,
    stop_loss: null,
    entry_condition: "",
    exit_condition: "",
    is_favourite: false,
    precheck_list_id: "",
    mood: "",
    risk_amount: null,
    plan_compliance: null,
    expiry: null,
    strategies: [...(opts?.defaultStrategies ?? [])],
    emotions: [],
    mistakes: [],
    wentWell: [],
    notes: "",
    exits: [],
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
  return parts.join("\n\n") || "";
}

export function liveTradeCalc(values: AddTradeFormValues) {
  const opened = combineDateTime(values.entryDate, values.entryTime);
  const fills = [
    {
      leg_type: "entry" as const,
      quantity: Number(values.quantity) || 0,
      price: Number(values.entry_price) || 0,
    },
    ...values.exits
      .filter((leg) => Number(leg.quantity) > 0 && Number(leg.price) > 0)
      .map((leg) => ({
        leg_type: "exit" as const,
        quantity: Number(leg.quantity),
        price: Number(leg.price),
        fees: Number(leg.fees || 0),
      })),
  ];
  return calculateTrade({
    assetType: values.asset_type,
    symbol: values.symbol || "AAPL",
    side: values.side,
    openedAt: opened ? new Date(opened) : new Date(),
    fills,
    fees: Number(values.fees || 0),
    stopLoss: values.stop_loss != null ? Number(values.stop_loss) : null,
    riskAmount: values.risk_amount != null ? Number(values.risk_amount) : null,
    leverage: values.leverage != null ? Number(values.leverage) : null,
    contractSize: values.contract_size != null ? Number(values.contract_size) : null,
    tickSize: values.tick_size != null ? Number(values.tick_size) : null,
    tickValue: values.tick_value != null ? Number(values.tick_value) : null,
  });
}

export function tradeDisplayStatus(values: AddTradeFormValues) {
  return displayStatus(
    liveTradeCalc(values).remainingQuantity,
    liveTradeCalc(values).sellQuantity
  );
}

export function applySegmentDefaults(
  values: AddTradeFormValues,
  next: AddTradeFormValues["asset_type"],
  opts?: { defaultLeverage?: number | null }
): Partial<AddTradeFormValues> {
  const patch: Partial<AddTradeFormValues> = { asset_type: next };
  const symbol = values.symbol;
  const inst = getInstrument(next, symbol);

  if (next !== "option") {
    patch.option_type = "";
    patch.strike_price = null;
    patch.expiry_date = null;
    patch.expiry = null;
  }
  if (next !== "forex" && next !== "crypto") {
    patch.leverage = null;
  }
  if (next === "forex" && (values.leverage == null || Number(values.leverage) < 1)) {
    patch.leverage = opts?.defaultLeverage && opts.defaultLeverage >= 1 ? opts.defaultLeverage : 100;
  }
  if (next === "crypto" && values.asset_type !== "crypto") {
    patch.leverage = values.leverage && Number(values.leverage) >= 1 ? values.leverage : null;
  }
  if (next !== "future") {
    patch.tick_size = null;
    patch.tick_value = null;
  }
  if (next === "option") {
    patch.contract_size = inst?.lotSize ?? defaultLotSize(symbol) ?? 100;
  } else if (next === "forex") {
    patch.contract_size = inst?.contractSize ?? defaultContractSize("forex", symbol);
  } else if (next === "future") {
    patch.contract_size = inst?.contractSize ?? defaultContractSize("future", symbol);
    patch.tick_size = inst?.tickSize ?? values.tick_size ?? null;
    patch.tick_value = inst?.tickValue ?? values.tick_value ?? null;
  } else {
    patch.contract_size = null;
  }

  if (symbol && !getInstrument(next, symbol)) {
    const knownElsewhere = ["stock", "forex", "crypto", "option", "future"].some(
      (seg) => seg !== next && getInstrument(seg as AddTradeFormValues["asset_type"], symbol)
    );
    if (knownElsewhere) patch.symbol = "";
  }
  return patch;
}

function splitIso(iso?: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  return {
    date: d.toISOString().slice(0, 10),
    time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
  };
}

export function mapTradeToForm(trade: Trade): AddTradeFormValues {
  const opened = splitIso(trade.opened_at);
  const exits = (trade.executions ?? [])
    .filter((row) => row.leg_type === "exit")
    .map((row) => {
      const at = splitIso(row.executed_at);
      return {
        quantity: Number(row.quantity),
        price: Number(row.price),
        date: at.date,
        time: at.time,
        condition: row.condition || "",
        fees: Number(row.fees || 0),
      };
    });
  const extra = trade.extra || {};
  let notes = trade.notes || "";
  let wentWell: string[] = [];
  const wellMarker = "What went well:";
  const wellIdx = notes.indexOf(wellMarker);
  if (wellIdx >= 0) {
    const wellLine = notes.slice(wellIdx + wellMarker.length).split("\n")[0];
    wentWell = wellLine.split(",").map((s) => s.trim()).filter(Boolean);
    notes = notes.slice(0, wellIdx).trim();
  }
  const extraWell = typeof extra.went_well === "string" ? extra.went_well : "";
  if (extraWell) {
    wentWell = extraWell.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return {
    asset_type: trade.asset_type,
    symbol: trade.symbol,
    side: trade.side,
    status: trade.status,
    account_id: trade.account_id,
    session: trade.session || "",
    trade_type: trade.trade_type || "",
    option_type: trade.option_type || "",
    analysis_timeframe: trade.analysis_timeframe || "",
    entry_timeframe: trade.entry_timeframe || "",
    entryDate: opened.date,
    entryTime: opened.time,
    exitDate: opened.date,
    exitTime: opened.time,
    entry_price: Number(trade.entry_price),
    exit_price: trade.exit_price != null ? Number(trade.exit_price) : null,
    quantity: Number(trade.quantity),
    fees: Number(trade.fees || 0),
    leverage: trade.leverage != null ? Number(trade.leverage) : null,
    contract_size: trade.contract_size != null ? Number(trade.contract_size) : null,
    strike_price: trade.strike_price != null ? Number(trade.strike_price) : null,
    expiry_date: trade.expiry_date ? String(trade.expiry_date).slice(0, 10) : null,
    tick_size: trade.tick_size != null ? Number(trade.tick_size) : null,
    tick_value: trade.tick_value != null ? Number(trade.tick_value) : null,
    stop_loss: trade.stop_loss != null ? Number(trade.stop_loss) : null,
    entry_condition: trade.entry_condition || "",
    exit_condition: trade.exit_condition || "",
    is_favourite: Boolean(trade.is_favourite),
    precheck_list_id: trade.precheck_list_id || "",
    mood: trade.mood || "",
    risk_amount: trade.risk_amount != null ? Number(trade.risk_amount) : null,
    plan_compliance: trade.plan_compliance != null ? Number(trade.plan_compliance) : null,
    expiry: trade.expiry_date ? String(trade.expiry_date).slice(0, 10) : null,
    strategies: trade.setup_tags?.length ? trade.setup_tags : trade.setup_tag ? [trade.setup_tag] : [],
    emotions: trade.emotion_tags ?? [],
    mistakes: trade.rules_broken ?? [],
    wentWell,
    notes,
    exits,
  };
}

export function estimatePnl(values: AddTradeFormValues) {
  return liveTradeCalc(values).pnl;
}

export function riskReward(values: Pick<AddTradeFormValues, "entry_price" | "exit_price" | "side" | "stop_loss">) {
  const entry = Number(values.entry_price);
  if (!entry) return null;
  const stop = Number(values.stop_loss);
  const exit = Number(values.exit_price);
  const risk = stop > 0 ? Math.abs(entry - stop) : entry * 0.01;
  if (!risk) return null;
  const target = exit > 0 ? Math.abs(exit - entry) : risk;
  return target / risk;
}

export function tradeDurationHours(values: AddTradeFormValues) {
  const open = combineDateTime(values.entryDate, values.entryTime);
  const lastExit = values.exits[values.exits.length - 1];
  const close =
    lastExit?.date && lastExit.time
      ? combineDateTime(lastExit.date, lastExit.time)
      : combineDateTime(values.exitDate, values.exitTime);
  if (!open || !close) return null;
  return Math.max(0, (new Date(close).getTime() - new Date(open).getTime()) / 3600000);
}

export function completionPercent(values: AddTradeFormValues) {
  const checks = [
    !!values.symbol,
    Number(values.entry_price) > 0,
    Number(values.quantity) > 0,
    !!values.entryDate && !!values.entryTime,
    values.strategies.length > 0 || !!values.trade_type,
    !!(values.notes && values.notes.trim().length > 10),
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}
