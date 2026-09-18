import { addDays, localIso, parseLocalIso, startOfWeekSunday } from "@/lib/dateLocal";
import type { ReportSnapshot, ReportSnapshotSet } from "@/lib/reports/types";
import type { Trade } from "@/lib/types";

type DateKeyFn = (value: Date | string | number) => string;
type DisplayPnl = (pnl: number | null | undefined, fees?: number | null) => number | null;

type Prepared = {
  id: string;
  side: "long" | "short";
  pnl: number | null;
  volume: number;
  openDay: string;
  closeDay: string | null;
  openedAtMs: number;
  closedAtMs: number | null;
  holdMs: number | null;
  closed: boolean;
};

type SideCounts = { trades: number; wins: number; losses: number; be: number };

type RunState = {
  netPnl: number;
  peak: number;
  drawdown: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  dailyDrawdownCum: number;
  closedCount: number;
  winCount: number;
  lossCount: number;
  sumWins: number;
  sumLosses: number;
  largestWin: number;
  largestLoss: number;
  sumHoldMin: number;
  holdCount: number;
  longestHoldMin: number;
  tradingDays: number;
  sumDayDurationMin: number;
  maxDayDurationMin: number;
  sumDailyPnl: number;
  sumWinDayPnl: number;
  winDayCount: number;
  sumLossDayPnl: number;
  lossDayCount: number;
  sumDailyMaxProfit: number;
  maxProfitDays: number;
  sumDailyMaxLoss: number;
  maxLossDays: number;
  sumDailyVolume: number;
  volumeDays: number;
  totalVolume: number;
  longs: SideCounts;
  shorts: SideCounts;
  winStreak: number;
  lossStreak: number;
  maxWinStreak: number;
  maxLossStreak: number;
  longsOpen: number;
  shortsOpen: number;
  openCount: number;
};

function num(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v : 0;
}

function round2(n: unknown): number {
  return Number(num(n).toFixed(2));
}

function avg(sum: number, count: number): number {
  return count > 0 ? sum / count : 0;
}

function ratio(num: number, den: number): number {
  return den > 0 ? num / den : 0;
}

function emptySide(): SideCounts {
  return { trades: 0, wins: 0, losses: 0, be: 0 };
}

function initialState(): RunState {
  return {
    netPnl: 0,
    peak: 0,
    drawdown: 0,
    maxDrawdown: 0,
    maxDrawdownPct: 0,
    dailyDrawdownCum: 0,
    closedCount: 0,
    winCount: 0,
    lossCount: 0,
    sumWins: 0,
    sumLosses: 0,
    largestWin: 0,
    largestLoss: 0,
    sumHoldMin: 0,
    holdCount: 0,
    longestHoldMin: 0,
    tradingDays: 0,
    sumDayDurationMin: 0,
    maxDayDurationMin: 0,
    sumDailyPnl: 0,
    sumWinDayPnl: 0,
    winDayCount: 0,
    sumLossDayPnl: 0,
    lossDayCount: 0,
    sumDailyMaxProfit: 0,
    maxProfitDays: 0,
    sumDailyMaxLoss: 0,
    maxLossDays: 0,
    sumDailyVolume: 0,
    volumeDays: 0,
    totalVolume: 0,
    longs: emptySide(),
    shorts: emptySide(),
    winStreak: 0,
    lossStreak: 0,
    maxWinStreak: 0,
    maxLossStreak: 0,
    longsOpen: 0,
    shortsOpen: 0,
    openCount: 0,
  };
}

function snapshotValues(state: RunState, initialBalance: number): Record<string, number> {
  const avgWin = avg(state.sumWins, state.winCount);
  const avgLoss = avg(state.sumLosses, state.lossCount);
  const avgWinDay = avg(state.sumWinDayPnl, state.winDayCount);
  const avgLossDay = avg(state.sumLossDayPnl, state.lossDayCount);
  const profitFactor =
    state.sumLosses < 0 ? round2(state.sumWins / Math.abs(state.sumLosses)) : state.sumWins > 0 ? round2(state.sumWins) : 0;

  return {
    net_pnl_cumulative: round2(state.netPnl),
    avg_daily_net_pnl_cumulative: round2(avg(state.sumDailyPnl, state.tradingDays)),
    avg_daily_win_loss_cumulative: round2(ratio(avgWinDay, Math.abs(avgLossDay))),
    avg_loss_cumulative: round2(avgLoss),
    avg_max_trade_loss_cumulative: round2(avg(state.sumDailyMaxLoss, state.maxLossDays)),
    avg_max_trade_profit_cumulative: round2(avg(state.sumDailyMaxProfit, state.maxProfitDays)),
    avg_net_trade_pnl_cumulative: round2(avg(state.netPnl, state.closedCount)),
    avg_trade_win_loss_cumulative: round2(ratio(avgWin, Math.abs(avgLoss))),
    avg_win_cumulative: round2(avgWin),
    profit_factor_cumulative: profitFactor,
    expectancy_cumulative: round2(avg(state.netPnl, state.closedCount)),
    largest_win_cumulative: round2(state.largestWin),
    largest_loss_cumulative: round2(state.largestLoss),
    avg_trading_days_duration_cumulative: round2(avg(state.sumDayDurationMin, state.tradingDays)),
    avg_hold_time_cumulative: round2(avg(state.sumHoldMin, state.holdCount)),
    longest_trade_duration_cumulative: round2(state.longestHoldMin),
    max_trading_days_duration_cumulative: round2(state.maxDayDurationMin),
    drawdown: round2(state.drawdown),
    max_drawdown_cumulative: round2(state.maxDrawdown),
    max_drawdown_pct_cumulative: round2(state.maxDrawdownPct),
    avg_daily_volume_cumulative: round2(avg(state.sumDailyVolume, state.volumeDays)),
    daily_net_drawdown_cumulative: round2(state.dailyDrawdownCum),
    logged_days_cumulative: state.tradingDays,
    longs_breakeven_cumulative: state.longs.be,
    longs_losing_cumulative: state.longs.losses,
    longs_open_cumulative: state.longsOpen,
    longs_trades_cumulative: state.longs.trades,
    longs_winning_cumulative: state.longs.wins,
    net_account_balance: round2(initialBalance + state.netPnl),
    open_trades_cumulative: state.openCount,
    shorts_breakeven_cumulative: state.shorts.be,
    shorts_losing_cumulative: state.shorts.losses,
    shorts_winning_cumulative: state.shorts.wins,
    shorts_trades_cumulative: state.shorts.trades,
    shorts_open_cumulative: state.shortsOpen,
    volume_cumulative: round2(state.totalVolume),
    trades_cumulative: state.closedCount,
    win_streak: state.winStreak,
    loss_streak: state.lossStreak,
    max_win_streak_cumulative: state.maxWinStreak,
    max_loss_streak_cumulative: state.maxLossStreak,
    win_rate_cumulative: round2(state.closedCount ? (state.winCount / state.closedCount) * 100 : 0),
  };
}

function makeSnapshot(iso: string, periodPnl: number, state: RunState, initialBalance: number): ReportSnapshot {
  return {
    iso,
    tooltipDate: iso,
    periodPnl: round2(periodPnl),
    values: snapshotValues(state, initialBalance),
  };
}

function eachIsoDay(from: string, to: string): string[] {
  if (!from || !to || from > to) return [];
  const out: string[] = [];
  let cursor = parseLocalIso(from);
  const end = parseLocalIso(to);
  while (cursor.getTime() <= end.getTime()) {
    out.push(localIso(cursor));
    cursor = addDays(cursor, 1);
  }
  return out;
}

function weekKey(iso: string): string {
  return localIso(startOfWeekSunday(parseLocalIso(iso)));
}

function monthKey(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

function prepareTrade(trade: Trade, displayPnl: DisplayPnl, dateKey: DateKeyFn): Prepared {
  const opened = new Date(trade.opened_at);
  const closedAt = trade.closed_at ? new Date(trade.closed_at) : null;
  const closed = trade.status === "closed" && trade.pnl != null;
  const rawPnl = closed ? displayPnl(trade.pnl, trade.fees) : null;
  const pnl = rawPnl == null ? null : num(rawPnl);
  const holdMs =
    closedAt && Number.isFinite(closedAt.getTime())
      ? Math.max(0, closedAt.getTime() - opened.getTime())
      : null;
  return {
    id: trade.id,
    side: trade.side,
    pnl,
    volume: num(trade.quantity),
    openDay: dateKey(opened),
    closeDay: closedAt ? dateKey(closedAt) : null,
    openedAtMs: opened.getTime(),
    closedAtMs: closedAt ? closedAt.getTime() : null,
    holdMs,
    closed,
  };
}

function applyClosedTrade(state: RunState, row: Prepared) {
  if (!row.closed || row.pnl == null) return;
  const pnl = row.pnl;
  state.netPnl = round2(state.netPnl + pnl);
  state.peak = Math.max(state.peak, state.netPnl);
  state.drawdown = round2(Math.min(0, state.netPnl - state.peak));
  const ddMag = Math.abs(state.drawdown);
  if (ddMag > state.maxDrawdown) {
    state.maxDrawdown = round2(ddMag);
    const base = Math.abs(state.peak) > 1 ? Math.abs(state.peak) : 1;
    state.maxDrawdownPct = round2((ddMag / base) * 100);
  }

  state.closedCount += 1;
  state.totalVolume += row.volume;
  const side = row.side === "short" ? state.shorts : state.longs;
  side.trades += 1;

  if (pnl > 0) {
    state.winCount += 1;
    state.sumWins += pnl;
    side.wins += 1;
    state.largestWin = Math.max(state.largestWin, pnl);
    state.winStreak += 1;
    state.lossStreak = 0;
    state.maxWinStreak = Math.max(state.maxWinStreak, state.winStreak);
  } else if (pnl < 0) {
    state.lossCount += 1;
    state.sumLosses += pnl;
    side.losses += 1;
    state.largestLoss = Math.min(state.largestLoss, pnl);
    state.lossStreak += 1;
    state.winStreak = 0;
    state.maxLossStreak = Math.max(state.maxLossStreak, state.lossStreak);
  } else {
    side.be += 1;
    state.winStreak = 0;
    state.lossStreak = 0;
  }

  if (row.holdMs != null) {
    const mins = row.holdMs / 60000;
    state.sumHoldMin += mins;
    state.holdCount += 1;
    state.longestHoldMin = Math.max(state.longestHoldMin, mins);
  }
}

export function buildReportSnapshots(opts: {
  trades: Trade[];
  displayPnl: DisplayPnl;
  dateKey: DateKeyFn;
  dateFrom?: string;
  dateTo?: string;
  initialBalance: number;
}): ReportSnapshotSet {
  const empty: ReportSnapshotSet = { day: [], week: [], month: [] };
  const initialBalance = num(opts.initialBalance);
  const prepared = opts.trades.map((t) => prepareTrade(t, opts.displayPnl, opts.dateKey));
  if (prepared.length === 0) return empty;

  const daysPresent = prepared.flatMap((t) => (t.closeDay ? [t.openDay, t.closeDay] : [t.openDay]));
  daysPresent.sort();
  const start = opts.dateFrom || daysPresent[0];
  const end = opts.dateTo || daysPresent[daysPresent.length - 1];
  const days = eachIsoDay(start, end);
  if (days.length === 0) return empty;

  const closedByDay = new Map<string, Prepared[]>();
  const opensByDay = new Map<string, Prepared[]>();
  const closesByDay = new Map<string, Prepared[]>();

  const push = (map: Map<string, Prepared[]>, key: string, row: Prepared) => {
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  };

  for (const row of prepared) {
    push(opensByDay, row.openDay, row);
    if (row.closeDay) push(closesByDay, row.closeDay, row);
    if (row.closed) {
      const activityDay = row.closeDay || row.openDay;
      push(closedByDay, activityDay, row);
    }
  }

  const state = initialState();
  const openIds = new Set<string>();
  const openSide = new Map<string, "long" | "short">();

  const daySnaps: ReportSnapshot[] = [];
  const weekSnaps: ReportSnapshot[] = [];
  const monthSnaps: ReportSnapshot[] = [];

  let weekPnl = 0;
  let monthPnl = 0;
  let currentWeek = weekKey(days[0]);
  let currentMonth = monthKey(days[0]);

  const flushWeek = (iso: string) => {
    weekSnaps.push(makeSnapshot(iso, weekPnl, state, initialBalance));
    weekPnl = 0;
  };
  const flushMonth = (iso: string) => {
    monthSnaps.push(makeSnapshot(iso, monthPnl, state, initialBalance));
    monthPnl = 0;
  };

  for (const iso of days) {
    const wk = weekKey(iso);
    const mo = monthKey(iso);
    if (wk !== currentWeek) {
      flushWeek(days[daySnaps.length - 1] ?? iso);
      currentWeek = wk;
    }
    if (mo !== currentMonth) {
      flushMonth(days[daySnaps.length - 1] ?? iso);
      currentMonth = mo;
    }

    for (const row of opensByDay.get(iso) ?? []) {
      openIds.add(row.id);
      openSide.set(row.id, row.side);
    }

    const closedToday = (closedByDay.get(iso) ?? []).slice().sort((a, b) => {
      return (a.closedAtMs ?? a.openedAtMs) - (b.closedAtMs ?? b.openedAtMs);
    });

    let maxProfit = 0;
    let maxLoss = 0;
    let dailyPnl = 0;
    let dailyVolume = 0;

    for (const row of closedToday) {
      applyClosedTrade(state, row);
      if (row.pnl != null) {
        dailyPnl += row.pnl;
        if (row.pnl > maxProfit) maxProfit = row.pnl;
        if (row.pnl < maxLoss) maxLoss = row.pnl;
      }
      dailyVolume += row.volume;
    }

    const openedToday = opensByDay.get(iso) ?? [];
    const closedMarks = closesByDay.get(iso) ?? [];

    if (closedToday.length) {
      state.tradingDays += 1;
      state.sumDailyPnl += dailyPnl;
      if (dailyPnl > 0) {
        state.sumWinDayPnl += dailyPnl;
        state.winDayCount += 1;
      } else if (dailyPnl < 0) {
        state.sumLossDayPnl += dailyPnl;
        state.lossDayCount += 1;
      }
      if (maxProfit > 0) {
        state.sumDailyMaxProfit += maxProfit;
        state.maxProfitDays += 1;
      }
      if (maxLoss < 0) {
        state.sumDailyMaxLoss += maxLoss;
        state.maxLossDays += 1;
      }
      state.sumDailyVolume += dailyVolume;
      state.volumeDays += 1;
      if (dailyPnl < 0) state.dailyDrawdownCum = round2(state.dailyDrawdownCum + dailyPnl);

      const spanMins = tradingDayDurationMinutes(openedToday, closedToday);
      if (spanMins > 0) {
        state.sumDayDurationMin += spanMins;
        state.maxDayDurationMin = Math.max(state.maxDayDurationMin, spanMins);
      }
    }

    for (const row of closedMarks) {
      openIds.delete(row.id);
      openSide.delete(row.id);
    }

    let longsOpen = 0;
    let shortsOpen = 0;
    for (const id of openIds) {
      if (openSide.get(id) === "short") shortsOpen += 1;
      else longsOpen += 1;
    }
    state.longsOpen = longsOpen;
    state.shortsOpen = shortsOpen;
    state.openCount = openIds.size;

    weekPnl += dailyPnl;
    monthPnl += dailyPnl;
    daySnaps.push(makeSnapshot(iso, dailyPnl, state, initialBalance));
  }

  if (daySnaps.length) {
    flushWeek(daySnaps[daySnaps.length - 1].iso);
    flushMonth(daySnaps[daySnaps.length - 1].iso);
  }

  return { day: daySnaps, week: weekSnaps, month: monthSnaps };
}

function tradingDayDurationMinutes(openedToday: Prepared[], closedToday: Prepared[]): number {
  const openTimes = [
    ...openedToday.map((r) => r.openedAtMs),
    ...closedToday.map((r) => r.openedAtMs),
  ];
  const closeTimes = closedToday
    .map((r) => r.closedAtMs)
    .filter((ms): ms is number => ms != null);
  if (!openTimes.length || !closeTimes.length) {
    const holds = closedToday.map((r) => r.holdMs).filter((ms): ms is number => ms != null);
    if (!holds.length) return 0;
    return Math.max(...holds) / 60000;
  }
  return Math.max(0, (Math.max(...closeTimes) - Math.min(...openTimes)) / 60000);
}

export function seriesFromSnapshots(
  snapshots: ReportSnapshot[],
  metricId: string,
  formatLabel: (iso: string) => string
) {
  return snapshots.map((snap) => ({
    iso: snap.iso,
    label: formatLabel(snap.iso),
    tooltipDate: snap.tooltipDate,
    value: metricId === "daily_net_pnl" ? snap.periodPnl : (snap.values[metricId] ?? 0),
    periodPnl: snap.periodPnl,
  }));
}
