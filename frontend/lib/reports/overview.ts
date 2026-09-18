import { plannedRMultiple } from "@/lib/trades/previewStats";
import { formatDurationLong, formatMetricValue } from "@/lib/reports/format";
import { buildReportSnapshots, seriesFromSnapshots } from "@/lib/reports/series";
import type {
  DisplayPnlFn,
  MoneyFormatter,
  ReportSeriesPoint,
  ReportSnapshot,
} from "@/lib/reports/types";
import type { Trade } from "@/lib/types";

export type OverviewStatRow = {
  label: string;
  value: string;
};

export type OverviewMonthHighlight = {
  value: number;
  caption: string;
};

export type OverviewModel = {
  empty: boolean;
  bestMonth: OverviewMonthHighlight | null;
  lowestMonth: OverviewMonthHighlight | null;
  avgMonth: number | null;
  left: OverviewStatRow[];
  right: OverviewStatRow[];
  cumulative: ReportSeriesPoint[];
  daily: ReportSeriesPoint[];
};

function num(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v : 0;
}

function avg(sum: number, count: number): number | null {
  return count > 0 ? sum / count : null;
}

function formatMonthYear(iso: string): string {
  const d = new Date(`${iso.slice(0, 7)}-01T12:00:00`);
  if (!Number.isFinite(d.getTime())) return iso.slice(0, 7);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function money(value: number | null | undefined, formatMoney: MoneyFormatter): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return formatMetricValue(value, "currency", formatMoney);
}

function count(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return String(Math.round(value));
}

function ratio(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function rMultiple(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}R`;
}

function percent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}%`;
}

function duration(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return "—";
  return formatDurationLong(minutes);
}

function holdMinutes(trade: Trade): number | null {
  if (!trade.closed_at) return null;
  const start = new Date(trade.opened_at).getTime();
  const end = new Date(trade.closed_at).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return (end - start) / 60000;
}

function maxStreak(flags: boolean[]): number {
  let best = 0;
  let run = 0;
  for (const on of flags) {
    if (on) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return best;
}

function lastValues(snaps: ReportSnapshot[]): Record<string, number> {
  return snaps[snaps.length - 1]?.values ?? {};
}

function tradingDaySnaps(snaps: ReportSnapshot[]): ReportSnapshot[] {
  return snaps.filter((snap, i) => {
    const prev = i > 0 ? snaps[i - 1].values.trades_cumulative ?? 0 : 0;
    const curr = snap.values.trades_cumulative ?? 0;
    return curr > prev;
  });
}

export function buildOverviewModel(opts: {
  trades: Trade[];
  displayPnl: DisplayPnlFn;
  dateKey: (value: Date | string | number) => string;
  formatChartDate: (value: Date | string | number, style?: "short" | "monthYear") => string;
  dateFrom?: string;
  dateTo?: string;
  initialBalance: number;
  formatMoney: MoneyFormatter;
}): OverviewModel {
  const snapshots = buildReportSnapshots({
    trades: opts.trades,
    displayPnl: opts.displayPnl,
    dateKey: opts.dateKey,
    dateFrom: opts.dateFrom,
    dateTo: opts.dateTo,
    initialBalance: opts.initialBalance,
  });

  const days = snapshots.day;
  const months = snapshots.month;
  const end = lastValues(days);
  const closed = opts.trades.filter((t) => t.status === "closed" && t.pnl != null);
  const empty = closed.length === 0;

  const monthRows = months.filter((snap, i) => {
    const prev = i > 0 ? months[i - 1].values.trades_cumulative ?? 0 : 0;
    return (snap.values.trades_cumulative ?? 0) > prev || snap.periodPnl !== 0;
  });

  let bestMonth: OverviewMonthHighlight | null = null;
  let lowestMonth: OverviewMonthHighlight | null = null;
  if (monthRows.length) {
    const best = monthRows.reduce((a, b) => (b.periodPnl > a.periodPnl ? b : a));
    const worst = monthRows.reduce((a, b) => (b.periodPnl < a.periodPnl ? b : a));
    bestMonth = { value: best.periodPnl, caption: `in ${formatMonthYear(best.iso)}` };
    lowestMonth = { value: worst.periodPnl, caption: `in ${formatMonthYear(worst.iso)}` };
  }
  const avgMonth = months.length
    ? months.reduce((s, m) => s + m.periodPnl, 0) / months.length
    : null;

  let holdAll = 0;
  let holdAllN = 0;
  let holdWin = 0;
  let holdWinN = 0;
  let holdLoss = 0;
  let holdLossN = 0;
  let holdScratch = 0;
  let holdScratchN = 0;
  let fees = 0;
  let plannedR = 0;
  let plannedN = 0;
  let realizedR = 0;
  let realizedN = 0;
  let winTrades = 0;
  let lossTrades = 0;
  let beTrades = 0;
  const activity = new Set<string>();

  for (const trade of opts.trades) {
    activity.add(opts.dateKey(trade.opened_at));
    if (trade.closed_at) activity.add(opts.dateKey(trade.closed_at));
  }

  for (const trade of closed) {
    const pnl = opts.displayPnl(trade.pnl, trade.fees) ?? 0;
    fees += num(trade.fees);
    if (pnl > 0) winTrades += 1;
    else if (pnl < 0) lossTrades += 1;
    else beTrades += 1;

    const hold = holdMinutes(trade);
    if (hold != null) {
      holdAll += hold;
      holdAllN += 1;
      if (pnl > 0) {
        holdWin += hold;
        holdWinN += 1;
      } else if (pnl < 0) {
        holdLoss += hold;
        holdLossN += 1;
      } else {
        holdScratch += hold;
        holdScratchN += 1;
      }
    }
    const planned = plannedRMultiple(trade);
    if (planned != null) {
      plannedR += planned;
      plannedN += 1;
    }
    if (trade.r_multiple != null && Number.isFinite(Number(trade.r_multiple))) {
      realizedR += Number(trade.r_multiple);
      realizedN += 1;
    }
  }

  const trading = tradingDaySnaps(days);
  const winDays = trading.filter((d) => d.periodPnl > 0);
  const lossDays = trading.filter((d) => d.periodPnl < 0);
  const beDays = trading.filter((d) => d.periodPnl === 0);
  const ddDays = days.filter((d) => num(d.values.drawdown) < 0);
  const avgDd = avg(
    ddDays.reduce((s, d) => s + num(d.values.drawdown), 0),
    ddDays.length
  );
  const avgDdPct = avg(
    ddDays.reduce((s, d) => {
      const mag = Math.abs(num(d.values.drawdown));
      const peak = Math.abs(num(d.values.net_pnl_cumulative) - num(d.values.drawdown));
      return s + (mag / (peak > 1 ? peak : 1)) * 100;
    }, 0),
    ddDays.length
  );

  const bestDay = winDays.reduce((m, d) => Math.max(m, d.periodPnl), Number.NEGATIVE_INFINITY);
  const worstDay = lossDays.reduce((m, d) => Math.min(m, d.periodPnl), Number.POSITIVE_INFINITY);

  const left: OverviewStatRow[] = [
    { label: "Total P&L", value: money(empty ? null : end.net_pnl_cumulative, opts.formatMoney) },
    { label: "Average daily volume", value: ratio(empty ? null : end.avg_daily_volume_cumulative) },
    { label: "Average winning trade", value: money(winTrades ? end.avg_win_cumulative : null, opts.formatMoney) },
    { label: "Average losing trade", value: money(lossTrades ? end.avg_loss_cumulative : null, opts.formatMoney) },
    { label: "Total number of trades", value: count(closed.length) },
    { label: "Number of winning trades", value: count(winTrades) },
    { label: "Number of losing trades", value: count(lossTrades) },
    { label: "Number of break even trades", value: count(beTrades) },
    { label: "Max consecutive wins", value: count(end.max_win_streak_cumulative) },
    { label: "Max consecutive losses", value: count(end.max_loss_streak_cumulative) },
    { label: "Commissions & fees", value: money(fees, opts.formatMoney) },
    { label: "Largest profit", value: money(winTrades ? end.largest_win_cumulative : null, opts.formatMoney) },
    { label: "Largest loss", value: money(lossTrades ? end.largest_loss_cumulative : null, opts.formatMoney) },
    { label: "Average hold time (All trades)", value: duration(avg(holdAll, holdAllN)) },
    { label: "Average hold time (Winning trades)", value: duration(avg(holdWin, holdWinN)) },
    { label: "Average hold time (Losing trades)", value: duration(avg(holdLoss, holdLossN)) },
    { label: "Average hold time (Scratch trades)", value: duration(avg(holdScratch, holdScratchN)) },
    { label: "Average trade P&L", value: money(empty ? null : end.avg_net_trade_pnl_cumulative, opts.formatMoney) },
    { label: "Profit factor", value: ratio(empty ? null : end.profit_factor_cumulative) },
  ];

  const right: OverviewStatRow[] = [
    { label: "Open trades", value: count(end.open_trades_cumulative) },
    { label: "Total trading days", value: count(end.logged_days_cumulative) },
    { label: "Winning days", value: count(winDays.length) },
    { label: "Losing days", value: count(lossDays.length) },
    { label: "Breakeven days", value: count(beDays.length) },
    { label: "Logged days", value: count(activity.size) },
    { label: "Max consecutive winning days", value: count(maxStreak(trading.map((d) => d.periodPnl > 0))) },
    { label: "Max consecutive losing days", value: count(maxStreak(trading.map((d) => d.periodPnl < 0))) },
    { label: "Average daily P&L", value: money(empty ? null : end.avg_daily_net_pnl_cumulative, opts.formatMoney) },
    {
      label: "Average winning day P&L",
      value: money(avg(winDays.reduce((s, d) => s + d.periodPnl, 0), winDays.length), opts.formatMoney),
    },
    {
      label: "Average losing day P&L",
      value: money(avg(lossDays.reduce((s, d) => s + d.periodPnl, 0), lossDays.length), opts.formatMoney),
    },
    {
      label: "Largest profitable day (Profits)",
      value: money(Number.isFinite(bestDay) ? bestDay : null, opts.formatMoney),
    },
    {
      label: "Largest losing day (Losses)",
      value: money(Number.isFinite(worstDay) ? worstDay : null, opts.formatMoney),
    },
    { label: "Average planned R-Multiple", value: rMultiple(avg(plannedR, plannedN)) },
    { label: "Average realized R-Multiple", value: rMultiple(avg(realizedR, realizedN)) },
    { label: "Trade expectancy", value: money(empty ? null : end.expectancy_cumulative, opts.formatMoney) },
    {
      label: "Max drawdown",
      value: money(end.max_drawdown_cumulative ? -Math.abs(end.max_drawdown_cumulative) : empty ? null : 0, opts.formatMoney),
    },
    {
      label: "Max drawdown, %",
      value: percent(end.max_drawdown_pct_cumulative ? -Math.abs(end.max_drawdown_pct_cumulative) : empty ? null : 0),
    },
    { label: "Average drawdown", value: money(avgDd, opts.formatMoney) },
    { label: "Average drawdown, %", value: percent(avgDdPct != null ? -Math.abs(avgDdPct) : null) },
  ];

  const labelFor = (iso: string) => opts.formatChartDate(new Date(`${iso}T12:00:00`));
  const cumulative = seriesFromSnapshots(days, "net_pnl_cumulative", labelFor);
  const daily = seriesFromSnapshots(
    trading.filter((d) => d.periodPnl !== 0),
    "daily_net_pnl",
    labelFor
  );

  return {
    empty,
    bestMonth,
    lowestMonth,
    avgMonth,
    left,
    right,
    cumulative,
    daily,
  };
}
