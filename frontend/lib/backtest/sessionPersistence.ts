/** Idempotent save batches for a manual session. Client ids never change between retries. */

import type { ClosedTrade } from "./orderEngine";
import type { BookOrder } from "./sessionBook";

export type SaveOrder = {
  id: string;
  side: BookOrder["side"];
  order_type: BookOrder["kind"];
  size: number;
  price: number | null;
  sl: number | null;
  tp: number | null;
  status: BookOrder["status"];
  created_ms: number;
  filled_ms: number | null;
};

export type SaveTrade = {
  id: string;
  side: ClosedTrade["side"];
  size: number;
  entry_ms: number;
  entry_price: number;
  exit_ms: number;
  exit_price: number;
  sl: number | null;
  tp: number | null;
  exit_reason: "tp" | "sl" | "manual" | "session end";
  client_pnl: number;
};

export type SaveBatch = {
  cursorMs: number;
  notes: string | null;
  orders: SaveOrder[];
  trades: SaveTrade[];
};

const EXIT_REASONS = new Set(["tp", "sl", "manual", "session end"]);

export function buildBatch(orders: readonly BookOrder[], trades: readonly ClosedTrade[], cursorMs: number, notes: string | null): SaveBatch {
  const seen = new Set<string>();
  return {
    cursorMs,
    notes,
    orders: orders.map((order) => ({
      id: order.id,
      side: order.side,
      order_type: order.kind,
      size: order.size,
      price: order.price,
      sl: order.sl,
      tp: order.tp,
      status: order.status,
      created_ms: order.createdMs,
      filled_ms: order.filledMs,
    })),
    trades: trades.flatMap((trade) => {
      if (seen.has(trade.id) || !EXIT_REASONS.has(trade.exitReason)) return [];
      seen.add(trade.id);
      return [
        {
          id: trade.id,
          side: trade.side,
          size: trade.size,
          entry_ms: trade.entryTime,
          entry_price: trade.entryPrice,
          exit_ms: trade.exitTime,
          exit_price: trade.exitPrice,
          sl: trade.sl,
          tp: trade.tp,
          exit_reason: trade.exitReason as SaveTrade["exit_reason"],
          client_pnl: trade.pnl,
        },
      ];
    }),
  };
}

/** Delay before another attempt, or null when the batch should stop retrying. */
export function retryDelayMs(attempt: number, retryAfterS?: number): number | null {
  if (attempt >= 4) return null;
  if (retryAfterS != null && retryAfterS > 0) return retryAfterS * 1000;
  return Math.min(1000 * 2 ** attempt, 15_000);
}

export function sameOrderIds(left: readonly { id: string }[], right: readonly { id: string }[]): boolean {
  return left.length === right.length && left.every((order, index) => order.id === right[index]?.id);
}
