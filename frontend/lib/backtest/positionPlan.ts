import type { OrderKind, Side } from "@/lib/backtest/rules";

export type PositionPlan = {
  side: "long" | "short";
  entry: number;
  stop: number;
  target: number;
  qty: number;
};

export type PlannedOrder = {
  side: Side;
  kind: OrderKind;
  size: number;
  price: number | null;
  sl: number | null;
  tp: number | null;
};

export type PlanResult = { ok: true; order: PlannedOrder } | { ok: false; reason: string };

/**
 * Turns a drawn position into an order request for the existing session engine.
 * The engine still validates and fills it; nothing here touches a broker.
 */
export function planToOrder(plan: PositionPlan, mark: number | null, tick: number): PlanResult {
  if (!(plan.qty > 0)) return { ok: false, reason: "Set a size above zero first." };
  if (mark == null) return { ok: false, reason: "Wait for a candle before simulating." };
  const long = plan.side === "long";
  const orderedLevels = long ? plan.stop < plan.entry && plan.entry < plan.target : plan.target < plan.entry && plan.entry < plan.stop;
  if (!orderedLevels) return { ok: false, reason: "Stop and target must sit on opposite sides of entry." };
  const side: Side = long ? "buy" : "sell";
  const atMarket = Math.abs(plan.entry - mark) <= tick / 2;
  const betterThanMarket = long ? plan.entry < mark : plan.entry > mark;
  const kind: OrderKind = atMarket ? "market" : betterThanMarket ? "limit" : "stop";
  return {
    ok: true,
    order: { side, kind, size: plan.qty, price: atMarket ? null : plan.entry, sl: plan.stop, tp: plan.target },
  };
}
