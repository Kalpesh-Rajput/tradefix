import {
  direction,
  pips,
  quoteIsAccount,
  rMultiple,
  triggerPrice,
  unitsFor,
  worse,
  type Bar,
  type Costs,
  type Instrument,
  type OrderRequest,
  type Side,
} from "./rules";

export type Action = {
  at: number;
  type: "place" | "cancel" | "close";
  order?: OrderRequest;
  orderId?: string;
};

export type Fill = {
  orderId: string;
  time: number;
  side: Side;
  price: number;
  rawPrice: number;
  size: number;
  reason: string;
};

export type ClosedTrade = {
  id: string;
  side: Side;
  size: number;
  entryTime: number;
  entryPrice: number;
  exitTime: number;
  exitPrice: number;
  sl: number | null;
  tp: number | null;
  exitReason: string;
  pips: number;
  rMultiple: number | null;
  pnl: number;
  pnlCurrency: string;
  commission: number;
};

export type SimResult = {
  fills: Fill[];
  trades: ClosedTrade[];
  warnings: string[];
  balance: number;
};

type Position = {
  id: string;
  side: Side;
  size: number;
  entryPrice: number;
  entryTime: number;
  sl: number | null;
  tp: number | null;
  entryCommission: number;
};

type Pending = { order: OrderRequest; queuedMarket: boolean };

export type EngineOptions = {
  instrument: Instrument;
  costs: Costs;
  accountCurrency?: string;
  initialBalance?: number;
  conversionRate?: number | null;
  closeAtEnd?: "end of data" | "session end" | null;
};

/** Same bar order as the Python engine: markets, pending, stop then target, closes, new actions. */
export class OrderEngine {
  private readonly instrument: Instrument;
  private readonly costs: Costs;
  private readonly accountCurrency: string;
  private readonly conversionRate: number | null;
  private readonly closeAtEnd: string | null;
  private balance: number;
  private pending: Pending[] = [];
  private position: Position | null = null;
  private fills: Fill[] = [];
  private trades: ClosedTrade[] = [];
  private warnings: string[] = [];

  constructor(options: EngineOptions) {
    this.instrument = options.instrument;
    this.costs = options.costs;
    this.accountCurrency = options.accountCurrency ?? "USD";
    this.conversionRate = options.conversionRate ?? null;
    this.closeAtEnd = options.closeAtEnd ?? null;
    this.balance = options.initialBalance ?? 10_000;
  }

  run(bars: readonly Bar[], actions: readonly Action[]): SimResult {
    const grouped = new Map<number, Action[]>();
    for (const action of actions) {
      const list = grouped.get(action.at) ?? [];
      list.push(action);
      grouped.set(action.at, list);
    }
    bars.forEach((bar, index) => {
      this.fillMarkets(bar);
      this.triggerPending(bar);
      this.protect(bar);
      for (const action of grouped.get(index) ?? []) {
        if (action.type === "close") this.closeAt(bar, "manual", bar.close, true);
      }
      for (const action of grouped.get(index) ?? []) {
        if (action.type === "cancel") this.pending = this.pending.filter((item) => item.order.id !== action.orderId);
        else if (action.type === "place" && action.order && action.order.size > 0) {
          this.pending.push({ order: action.order, queuedMarket: action.order.kind === "market" });
        }
      }
    });
    if (this.position && this.closeAtEnd && bars.length) {
      const last = bars[bars.length - 1];
      this.closeAt(last, this.closeAtEnd, last.close, false);
    }
    if (this.trades.some((trade) => trade.sl == null)) this.warnings.push("no_stop");
    return { fills: this.fills, trades: this.trades, warnings: this.warnings, balance: this.balance };
  }

  private fillMarkets(bar: Bar) {
    const ready = this.pending.filter((item) => item.queuedMarket);
    this.pending = this.pending.filter((item) => !item.queuedMarket);
    for (const item of ready) {
      if (this.position) continue;
      this.open(item.order, bar, bar.open, "market", true);
    }
  }

  private triggerPending(bar: Bar) {
    const still: Pending[] = [];
    for (const item of this.pending) {
      if (item.queuedMarket || this.position) {
        still.push(item);
        continue;
      }
      const raw = triggerPrice(item.order, bar);
      if (raw == null) {
        still.push(item);
        continue;
      }
      this.open(item.order, bar, raw, item.order.kind, item.order.kind === "stop");
    }
    this.pending = still;
  }

  private open(order: OrderRequest, bar: Bar, raw: number, reason: string, slipped: boolean) {
    const price = worse(raw, order.side, this.instrument.pipSize, this.costs, slipped);
    const commission = this.costs.commissionPerLot * order.size;
    this.fills.push({ orderId: order.id, time: bar.time, side: order.side, price, rawPrice: raw, size: order.size, reason });
    this.position = {
      id: order.id,
      side: order.side,
      size: order.size,
      entryPrice: price,
      entryTime: bar.time,
      sl: order.sl,
      tp: order.tp,
      entryCommission: commission,
    };
  }

  private protect(bar: Bar) {
    const position = this.position;
    if (!position) return;
    const stop = stopRaw(position, bar);
    if (stop != null) {
      this.closeAt(bar, "sl", stop, true);
      return;
    }
    const target = targetRaw(position, bar);
    if (target != null) this.closeAt(bar, "tp", target, false);
  }

  private closeAt(bar: Bar, reason: string, raw: number, slipped: boolean) {
    const position = this.position;
    if (!position) return;
    const exitSide: Side = position.side === "buy" ? "sell" : "buy";
    const price = worse(raw, exitSide, this.instrument.pipSize, this.costs, slipped);
    const exitCommission = this.costs.commissionPerLot * position.size;
    this.fills.push({
      orderId: position.id,
      time: bar.time,
      side: exitSide,
      price,
      rawPrice: raw,
      size: position.size,
      reason,
    });
    const trade = settle(position, bar.time, price, reason, this.instrument, this.accountCurrency, this.conversionRate, exitCommission, this.warnings);
    this.trades.push(trade);
    this.balance += trade.pnl;
    this.position = null;
  }
}

function stopRaw(position: Position, bar: Bar): number | null {
  if (position.sl == null) return null;
  if (position.side === "buy" && bar.low <= position.sl) return bar.open <= position.sl ? bar.open : position.sl;
  if (position.side === "sell" && bar.high >= position.sl) return bar.open >= position.sl ? bar.open : position.sl;
  return null;
}

function targetRaw(position: Position, bar: Bar): number | null {
  if (position.tp == null) return null;
  if (position.side === "buy" && bar.high >= position.tp) return bar.open >= position.tp ? bar.open : position.tp;
  if (position.side === "sell" && bar.low <= position.tp) return bar.open <= position.tp ? bar.open : position.tp;
  return null;
}

function settle(
  position: Position,
  exitTime: number,
  exitPrice: number,
  reason: string,
  instrument: Instrument,
  accountCurrency: string,
  conversionRate: number | null,
  exitCommission: number,
  warnings: string[]
): ClosedTrade {
  const qty = unitsFor(position.size, instrument);
  const quotePnl = direction(position.side) * (exitPrice - position.entryPrice) * qty;
  const commission = position.entryCommission + exitCommission;
  let pnl = quotePnl;
  let currency = instrument.quoteCurrency;
  if (quoteIsAccount(instrument.quoteCurrency, accountCurrency)) {
    pnl = quotePnl - commission;
    currency = accountCurrency;
  } else if (conversionRate != null) {
    pnl = quotePnl * conversionRate - commission;
    currency = accountCurrency;
  } else if (!warnings.includes("conversion_unavailable")) warnings.push("conversion_unavailable");
  return {
    id: position.id,
    side: position.side,
    size: position.size,
    entryTime: position.entryTime,
    entryPrice: position.entryPrice,
    exitTime,
    exitPrice,
    sl: position.sl,
    tp: position.tp,
    exitReason: reason,
    pips: pips(position.side, position.entryPrice, exitPrice, instrument.pipSize),
    rMultiple: rMultiple(position.side, position.entryPrice, exitPrice, position.sl),
    pnl,
    pnlCurrency: currency,
    commission,
  };
}
