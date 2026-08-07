import type { Trade, User } from "@/lib/types";

export type GoalPeriod = "week" | "month" | "year";

export type GoalsSlice = Pick<User, "weekly_goal" | "monthly_goal" | "yearly_goal" | "target_trades">;

export type GoalProgressItem = {
  id: string;
  label: string;
  current: number;
  target: number;
  unit: "money" | "trades";
};

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Monday-start week matching common trading journals. */
export function startOfWeek(d = new Date()): Date {
  const day = startOfLocalDay(d);
  const weekday = day.getDay(); // 0 Sun … 6 Sat
  const diff = weekday === 0 ? -6 : 1 - weekday;
  day.setDate(day.getDate() + diff);
  return day;
}

export function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function startOfYear(d = new Date()): Date {
  return new Date(d.getFullYear(), 0, 1);
}

function tradeTimestamp(trade: Trade): Date {
  return new Date(trade.closed_at || trade.opened_at);
}

export function sumPeriodPnl(
  trades: Trade[],
  start: Date,
  displayPnl: (pnl: number | null | undefined, fees?: number | null) => number | null
): number {
  const startMs = start.getTime();
  return trades.reduce((sum, trade) => {
    if (trade.status !== "closed" || trade.pnl == null) return sum;
    const ts = tradeTimestamp(trade).getTime();
    if (Number.isNaN(ts) || ts < startMs) return sum;
    return sum + (displayPnl(trade.pnl, trade.fees) ?? 0);
  }, 0);
}

export function countPeriodTrades(trades: Trade[], start: Date): number {
  const startMs = start.getTime();
  return trades.filter((trade) => {
    const ts = tradeTimestamp(trade).getTime();
    return !Number.isNaN(ts) && ts >= startMs;
  }).length;
}

export function hasAnyGoals(user?: GoalsSlice | null): boolean {
  if (!user) return false;
  return (
    (user.weekly_goal != null && user.weekly_goal > 0) ||
    (user.monthly_goal != null && user.monthly_goal > 0) ||
    (user.yearly_goal != null && user.yearly_goal > 0) ||
    (user.target_trades != null && user.target_trades > 0)
  );
}

export function buildGoalProgress(
  user: GoalsSlice | null | undefined,
  trades: Trade[],
  displayPnl: (pnl: number | null | undefined, fees?: number | null) => number | null,
  now = new Date()
): GoalProgressItem[] {
  if (!user) return [];
  const items: GoalProgressItem[] = [];

  if (user.weekly_goal != null && user.weekly_goal > 0) {
    items.push({
      id: "weekly",
      label: "Weekly P&L",
      current: sumPeriodPnl(trades, startOfWeek(now), displayPnl),
      target: Number(user.weekly_goal),
      unit: "money",
    });
  }
  if (user.monthly_goal != null && user.monthly_goal > 0) {
    items.push({
      id: "monthly",
      label: "Monthly P&L",
      current: sumPeriodPnl(trades, startOfMonth(now), displayPnl),
      target: Number(user.monthly_goal),
      unit: "money",
    });
  }
  if (user.yearly_goal != null && user.yearly_goal > 0) {
    items.push({
      id: "yearly",
      label: "Yearly P&L",
      current: sumPeriodPnl(trades, startOfYear(now), displayPnl),
      target: Number(user.yearly_goal),
      unit: "money",
    });
  }
  if (user.target_trades != null && user.target_trades > 0) {
    items.push({
      id: "trades",
      label: "Trade Count",
      current: countPeriodTrades(trades, startOfYear(now)),
      target: Number(user.target_trades),
      unit: "trades",
    });
  }

  return items;
}

export function yearlyGoalPercent(
  user: GoalsSlice | null | undefined,
  trades: Trade[],
  displayPnl: (pnl: number | null | undefined, fees?: number | null) => number | null,
  now = new Date()
): number | null {
  if (user?.yearly_goal == null || user.yearly_goal <= 0) return null;
  const current = sumPeriodPnl(trades, startOfYear(now), displayPnl);
  return (current / Number(user.yearly_goal)) * 100;
}

export function progressPercent(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, (current / target) * 100));
}
