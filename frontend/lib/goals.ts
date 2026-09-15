import { addDays, localIso, startOfWeekSunday } from "@/lib/dateLocal";
import type { CalendarDay, Trade, User } from "@/lib/types";

export type GoalPeriod = "day" | "week" | "month" | "year";

export type GoalsSlice = Pick<
  User,
  "daily_goal" | "weekly_goal" | "monthly_goal" | "yearly_goal" | "target_trades" | "monthly_goal_ack_month"
>;

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

export function startOfWeek(d = new Date()): Date {
  return startOfWeekSunday(d);
}

export function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function startOfYear(d = new Date()): Date {
  return new Date(d.getFullYear(), 0, 1);
}

export function currentMonthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function tradeTimestamp(trade: Trade): Date {
  return new Date(trade.closed_at || trade.opened_at);
}

export function sumPeriodPnl(
  trades: Trade[],
  start: Date,
  displayPnl: (pnl: number | null | undefined, fees?: number | null) => number | null,
  end?: Date
): number {
  const startMs = start.getTime();
  const endMs = end ? end.getTime() : Number.POSITIVE_INFINITY;
  return trades.reduce((sum, trade) => {
    if (trade.status !== "closed" || trade.pnl == null) return sum;
    const ts = tradeTimestamp(trade).getTime();
    if (Number.isNaN(ts) || ts < startMs || ts > endMs) return sum;
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

export function sumCalendarRange(
  days: Array<Pick<CalendarDay, "date" | "pnl">>,
  startIso: string,
  endIso: string
): number {
  return days.reduce((sum, day) => {
    const key = day.date.slice(0, 10);
    if (key < startIso || key > endIso) return sum;
    return sum + day.pnl;
  }, 0);
}

export function hasAnyGoals(user?: GoalsSlice | null): boolean {
  if (!user) return false;
  return (
    (user.daily_goal != null && user.daily_goal > 0) ||
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
  const today = startOfLocalDay(now);

  if (user.daily_goal != null && user.daily_goal > 0) {
    items.push({
      id: "daily",
      label: "Daily P&L",
      current: sumPeriodPnl(trades, today, displayPnl),
      target: Number(user.daily_goal),
      unit: "money",
    });
  }
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

export function buildGoalProgressFromCalendar(
  user: GoalsSlice | null | undefined,
  days: Array<Pick<CalendarDay, "date" | "pnl" | "trades">>,
  now = new Date()
): GoalProgressItem[] {
  if (!user) return [];
  const items: GoalProgressItem[] = [];
  const todayIso = localIso(now);
  const weekStart = localIso(startOfWeekSunday(now));
  const weekEnd = localIso(addDays(startOfWeekSunday(now), 6));
  const monthStart = localIso(startOfMonth(now));
  const yearStart = localIso(startOfYear(now));

  if (user.daily_goal != null && user.daily_goal > 0) {
    items.push({
      id: "daily",
      label: "Daily P&L",
      current: sumCalendarRange(days, todayIso, todayIso),
      target: Number(user.daily_goal),
      unit: "money",
    });
  }
  if (user.weekly_goal != null && user.weekly_goal > 0) {
    items.push({
      id: "weekly",
      label: "Weekly P&L",
      current: sumCalendarRange(days, weekStart, weekEnd),
      target: Number(user.weekly_goal),
      unit: "money",
    });
  }
  if (user.monthly_goal != null && user.monthly_goal > 0) {
    items.push({
      id: "monthly",
      label: "Monthly P&L",
      current: sumCalendarRange(days, monthStart, todayIso),
      target: Number(user.monthly_goal),
      unit: "money",
    });
  }
  if (user.yearly_goal != null && user.yearly_goal > 0) {
    items.push({
      id: "yearly",
      label: "Yearly P&L",
      current: sumCalendarRange(days, yearStart, todayIso),
      target: Number(user.yearly_goal),
      unit: "money",
    });
  }
  if (user.target_trades != null && user.target_trades > 0) {
    const trades = days
      .filter((d) => d.date.slice(0, 10) >= yearStart && d.date.slice(0, 10) <= todayIso)
      .reduce((sum, d) => sum + (d.trades ?? 0), 0);
    items.push({
      id: "trades",
      label: "Trade Count",
      current: trades,
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

export function remainingToGoal(current: number, target: number): number {
  return target - current;
}
