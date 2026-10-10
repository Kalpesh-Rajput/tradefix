import { localIso, parseLocalIso } from "@/lib/dateLocal";
import type { EquityPoint, Trade } from "@/lib/types";

export type LinePoint = { date: string; value: number; baseline?: number };
export type DrawdownPoint = { date: string; value: number };
export type ScatterPoint = { x: number; y: number; label: string; symbol: string };

export function equityFromClosedTrades(
  trades: Trade[],
  pnlOf: (t: Trade) => number
): EquityPoint[] {
  let sum = 0;
  return [...trades]
    .filter((t) => t.status === "closed" && t.pnl != null)
    .sort(
      (a, b) =>
        new Date(a.closed_at || a.opened_at).getTime() -
        new Date(b.closed_at || b.opened_at).getTime()
    )
    .map((t) => {
      sum += pnlOf(t);
      const when = new Date(t.closed_at || t.opened_at);
      return { date: localIso(when), value: Number(sum.toFixed(2)) };
    });
}

export function accountBalanceSeries(
  equity: EquityPoint[],
  initialBalance: number,
  formatDate: (d: Date) => string
): LinePoint[] {
  if (equity.length === 0) {
    if (!Number.isFinite(initialBalance) || initialBalance === 0) return [];
    return [
      {
        date: formatDate(new Date()),
        value: initialBalance,
        baseline: initialBalance,
      },
    ];
  }
  return equity.map((p) => ({
    date: formatDate(new Date(`${p.date}T12:00:00`)),
    value: Number((initialBalance + p.value).toFixed(2)),
    baseline: initialBalance,
  }));
}

export function drawdownSeries(equity: EquityPoint[], formatDate: (d: Date) => string): DrawdownPoint[] {
  let peak = Number.NEGATIVE_INFINITY;
  return equity.map((p) => {
    peak = Math.max(peak, p.value);
    const dd = Math.min(0, Number((p.value - peak).toFixed(2)));
    return { date: formatDate(new Date(`${p.date}T12:00:00`)), value: dd };
  });
}

export function tradeTimePoints(
  trades: Trade[],
  pnlOf: (t: Trade) => number
): ScatterPoint[] {
  return trades
    .filter((t) => t.status === "closed" && t.pnl != null)
    .map((t) => {
      const opened = new Date(t.opened_at);
      const minutes = opened.getHours() * 60 + opened.getMinutes();
      return {
        x: minutes,
        y: pnlOf(t),
        label: `${String(opened.getHours()).padStart(2, "0")}:${String(opened.getMinutes()).padStart(2, "0")}`,
        symbol: t.symbol,
      };
    });
}

export function tradeDurationPoints(
  trades: Trade[],
  pnlOf: (t: Trade) => number
): ScatterPoint[] {
  return trades
    .filter((t) => t.status === "closed" && t.pnl != null && t.closed_at)
    .map((t) => {
      const ms = new Date(t.closed_at as string).getTime() - new Date(t.opened_at).getTime();
      const minutes = Math.max(0, Math.round(ms / 60000));
      return {
        x: minutes,
        y: pnlOf(t),
        label: formatDuration(minutes),
        symbol: t.symbol,
      };
    });
}

export function formatDuration(totalMinutes: number): string {
  if (totalMinutes < 60) {
    return `${totalMinutes}m 0s`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}h ${mins}m`;
}

export function formatClock(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function parseLocalDay(iso: string): Date {
  return parseLocalIso(iso);
}
