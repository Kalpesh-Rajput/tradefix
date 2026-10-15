/** Live session book: one order engine plus the order rows the server stores. */

import { OrderEngine, type ClosedTrade, type EngineView } from "./orderEngine";
import { direction, unitsFor, type Costs, type Instrument, type OrderKind, type Side } from "./rules";
import type { SessionDetail } from "./sessions";

export type LevelMode = "price" | "pips" | "r";

export type BookOrder = {
  id: string;
  side: Side;
  kind: OrderKind;
  size: number;
  price: number | null;
  sl: number | null;
  tp: number | null;
  status: "pending" | "filled" | "cancelled" | "rejected";
  createdMs: number;
  filledMs: number | null;
  cancelRequested: boolean;
};

export type PlaceInput = {
  side: Side;
  kind: OrderKind;
  size: number;
  price: number | null;
  sl: number | null;
  tp: number | null;
  nowMs: number;
  mark: number | null;
};

export function sizeForRisk(balance: number, riskPercent: number, stopDistance: number, instrument: Instrument): number | null {
  if (!(balance > 0) || !(riskPercent > 0) || !(stopDistance > 0)) return null;
  const units = (balance * (riskPercent / 100)) / stopDistance;
  const size = instrument.assetClass === "crypto" ? units : units / instrument.contractSize;
  return size > 0 && Number.isFinite(size) ? size : null;
}

export function levelPrice(args: {
  side: Side;
  role: "sl" | "tp";
  mode: LevelMode;
  value: number;
  reference: number;
  pipSize: number;
  stopDistance: number | null;
}): number | null {
  if (!Number.isFinite(args.value) || (args.value <= 0 && args.mode !== "price")) return null;
  if (args.mode === "price") return args.value;
  const towardStop = args.role === "sl" ? -1 : 1;
  const sign = direction(args.side) * towardStop;
  if (args.mode === "pips" || args.role === "sl") return args.reference + sign * args.value * args.pipSize;
  if (args.stopDistance == null || args.stopDistance <= 0) return null;
  return args.reference + sign * args.value * args.stopDistance;
}

export function floatingPnl(position: EngineView["position"], mark: number | null, instrument: Instrument): number {
  if (!position || mark == null) return 0;
  return direction(position.side) * (mark - position.entryPrice) * unitsFor(position.size, instrument);
}

export class SessionBook {
  readonly engine: OrderEngine;
  readonly orders: BookOrder[] = [];
  private readonly ids: () => string;
  private readonly instrument: Instrument;

  constructor(engine: OrderEngine, instrument: Instrument, ids: () => string) {
    this.engine = engine;
    this.instrument = instrument;
    this.ids = ids;
  }

  static create(options: {
    instrument: Instrument;
    costs: Costs;
    currency: string;
    balance: number;
    ids?: () => string;
  }): SessionBook {
    const engine = new OrderEngine({
      instrument: options.instrument,
      costs: options.costs,
      accountCurrency: options.currency,
      initialBalance: options.balance,
    });
    return new SessionBook(engine, options.instrument, options.ids ?? (() => crypto.randomUUID()));
  }

  static fromSession(detail: SessionDetail, instrument: Instrument, ids?: () => string): SessionBook {
    const book = SessionBook.create({
      instrument,
      costs: { spreadPips: detail.spread_pips, commissionPerLot: detail.commission_per_lot, slippagePips: 0 },
      currency: detail.currency,
      balance: detail.initial_balance,
      ids,
    });
    const trades: ClosedTrade[] = detail.trades.map((trade) => ({
      id: trade.id,
      side: trade.side,
      size: trade.size,
      entryTime: trade.entry_ms,
      entryPrice: trade.entry_price,
      exitTime: trade.exit_ms,
      exitPrice: trade.exit_price,
      sl: trade.sl,
      tp: trade.tp,
      exitReason: trade.exit_reason,
      pips: trade.pips,
      rMultiple: trade.r_multiple,
      pnl: trade.pnl,
      pnlCurrency: trade.pnl_currency,
      commission: trade.commission,
    }));
    const closed = new Set(trades.map((trade) => trade.id));
    const open = detail.orders.find((order) => order.status === "filled" && !closed.has(order.id) && order.price != null);
    book.engine.restore({
      balance: detail.stats.balance,
      position: open
        ? {
            id: open.id,
            side: open.side,
            size: open.size,
            entryPrice: open.price ?? 0,
            entryTime: open.filled_ms ?? open.created_ms,
            sl: open.sl,
            tp: open.tp,
            entryCommission: detail.commission_per_lot * open.size,
          }
        : null,
      pending: detail.orders
        .filter((order) => order.status === "pending")
        .map((order) => ({
          order: {
            id: order.id,
            side: order.side,
            kind: order.order_type,
            size: order.size,
            price: order.price,
            sl: order.sl,
            tp: order.tp,
          },
          queuedMarket: order.order_type === "market",
        })),
      trades,
    });
    for (const order of detail.orders) {
      book.orders.push({
        id: order.id,
        side: order.side,
        kind: order.order_type,
        size: order.size,
        price: order.price,
        sl: order.sl,
        tp: order.tp,
        status: order.status,
        createdMs: order.created_ms,
        filledMs: order.filled_ms,
        cancelRequested: false,
      });
    }
    return book;
  }

  view(): EngineView {
    return this.engine.view();
  }

  hasExposure(): boolean {
    const view = this.view();
    return view.position != null || view.pending.length > 0;
  }

  place(input: PlaceInput): string | null {
    if (!(input.size > 0)) return "Size has to be greater than zero.";
    const view = this.view();
    if (input.kind === "market" && view.position) return "Close the open position before a market order.";
    const reference = input.kind === "market" ? input.mark : input.price;
    if (reference == null || !Number.isFinite(reference)) return input.kind === "market" ? "Wait for a price." : "Enter a price.";
    if (input.sl != null && direction(input.side) * (reference - input.sl) <= 0) return "The stop is on the wrong side of the price.";
    if (input.tp != null && direction(input.side) * (input.tp - reference) <= 0) return "The target is on the wrong side of the price.";
    if (input.sl != null) {
      const risk = Math.abs(reference - input.sl) * unitsFor(input.size, this.instrument);
      if (risk > view.balance) return "That stop risks more than the balance.";
    }
    const id = this.ids();
    this.orders.push({
      id,
      side: input.side,
      kind: input.kind,
      size: input.size,
      price: input.price,
      sl: input.sl,
      tp: input.tp,
      status: "pending",
      createdMs: input.nowMs,
      filledMs: null,
      cancelRequested: false,
    });
    this.engine.accept({
      at: input.nowMs,
      type: "place",
      order: { id, side: input.side, kind: input.kind, size: input.size, price: input.price, sl: input.sl, tp: input.tp },
    });
    return null;
  }

  requestCancel(id: string) {
    const order = this.orders.find((item) => item.id === id && item.status === "pending");
    if (!order) return;
    order.cancelRequested = true;
    this.engine.accept({ at: order.createdMs, type: "cancel", orderId: id });
  }

  requestClose(nowMs: number) {
    if (!this.view().position) return;
    this.engine.accept({ at: nowMs, type: "close" });
  }

  setProtection(sl: number | null, tp: number | null) {
    this.engine.setProtection(sl, tp);
    const position = this.view().position;
    if (!position) return;
    const order = this.orders.find((item) => item.id === position.id);
    if (!order) return;
    order.sl = sl;
    order.tp = tp;
  }

  onBar(bar: { time: number; open: number; high: number; low: number; close: number }) {
    this.engine.step(bar);
    this.sync(bar.time);
  }

  finish(time: number, price: number) {
    this.engine.closeNow(time, price, "session end");
    this.sync(time);
  }

  private sync(time: number) {
    const view = this.view();
    const pending = new Set(view.pending.map((item) => item.order.id));
    for (const order of this.orders) {
      if (order.status !== "pending") continue;
      if (pending.has(order.id)) continue;
      const trade = view.trades.find((item) => item.id === order.id);
      if (view.position?.id === order.id) {
        order.status = "filled";
        order.filledMs = view.position.entryTime;
        order.price = view.position.entryPrice;
      } else if (trade) {
        order.status = "filled";
        order.filledMs = trade.entryTime;
        order.price = trade.entryPrice;
      } else if (order.cancelRequested) {
        order.status = "cancelled";
        order.filledMs = null;
      } else {
        order.status = "rejected";
        order.filledMs = time;
      }
    }
  }
}
