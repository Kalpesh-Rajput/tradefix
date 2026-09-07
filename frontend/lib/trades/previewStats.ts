import type { Trade, TradeExecution } from "@/lib/types";

export function dash(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  return String(value);
}

export function tradeResult(trade: Trade): "Win" | "Loss" | "BE" | null {
  if (trade.status !== "closed" || trade.pnl == null) return null;
  if (Number(trade.pnl) > 0) return "Win";
  if (Number(trade.pnl) < 0) return "Loss";
  return "BE";
}

export function tradeRoi(trade: Trade): number | null {
  const invested = Number(trade.invested_amount);
  if (!invested || trade.pnl == null) return null;
  return (Number(trade.pnl) / invested) * 100;
}

export function tradeGrossPnl(trade: Trade): number | null {
  if (trade.pnl == null) return null;
  return Number(trade.pnl) + Number(trade.fees || 0);
}

export function tradePoints(trade: Trade): number | null {
  if (trade.exit_price == null) return null;
  return Math.abs(Number(trade.exit_price) - Number(trade.entry_price));
}

export function heldLabel(trade: Trade): string {
  const start = new Date(trade.opened_at).getTime();
  const end = new Date(trade.closed_at || Date.now()).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "—";
  const mins = Math.max(0, Math.round((end - start) / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hours < 24) return rem ? `${hours}h ${rem}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export function formatMdY(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

export function formatDateTime(iso: string | null | undefined, timeZone?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  try {
    return d.toLocaleString(undefined, {
      timeZone: timeZone || undefined,
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return d.toLocaleString();
  }
}

export function plannedRMultiple(trade: Trade): number | null {
  if (trade.profit_target == null || trade.stop_loss == null) return null;
  const entry = Number(trade.entry_price);
  const target = Number(trade.profit_target);
  const stop = Number(trade.stop_loss);
  const risk = trade.side === "long" ? entry - stop : stop - entry;
  const reward = trade.side === "long" ? target - entry : entry - target;
  if (risk <= 0) return null;
  return reward / risk;
}

export function assignedStrategy(trade: Trade): string | null {
  return trade.strategy_name || trade.setup_tag || trade.setup_tags?.[0] || null;
}

export function sortedExecutions(trade: Trade): TradeExecution[] {
  return [...(trade.executions ?? [])].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime();
  });
}

export function runningPnlSeries(trade: Trade): number[] {
  const execs = sortedExecutions(trade);
  if (execs.length < 2) {
    return trade.pnl != null ? [0, Number(trade.pnl)] : [];
  }
  const sign = trade.side === "short" ? -1 : 1;
  let qty = 0;
  let cost = 0;
  let realized = 0;
  const series = [0];
  for (const fill of execs) {
    const q = Number(fill.quantity);
    const price = Number(fill.price);
    if (fill.leg_type === "entry") {
      cost += price * q;
      qty += q;
    } else {
      const avg = qty > 0 ? cost / qty : price;
      realized += (price - avg) * q * sign - Number(fill.fees || 0);
      const remain = Math.max(0, qty - q);
      cost = qty > 0 && remain > 0 ? cost * (remain / qty) : 0;
      qty = remain;
    }
    series.push(realized);
  }
  return series;
}

export function executionGrossPnl(trade: Trade, fill: TradeExecution): number | null {
  if (fill.leg_type !== "exit") return 0;
  const sign = trade.side === "short" ? -1 : 1;
  const avg = Number(trade.entry_price);
  const q = Number(fill.quantity);
  const realized = (Number(fill.price) - avg) * q * sign - Number(fill.fees || 0);
  return Number.isFinite(realized) ? realized : null;
}

export function qtyLabel(n: number | null | undefined): string {
  if (n == null) return "—";
  const q = Number(n);
  return Number.isInteger(q) ? String(q) : q.toFixed(2).replace(/\.?0+$/, "");
}
