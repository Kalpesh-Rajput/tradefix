import {
  REPORT_METRIC_CATEGORIES,
  type ReportMetricCategory,
  type ReportMetricDef,
} from "@/lib/reports/types";

export const DEFAULT_REPORT_METRIC_ID = "net_pnl_cumulative";

export const REPORT_METRICS: ReportMetricDef[] = [
  // Time Analysis
  {
    id: "avg_trading_days_duration_cumulative",
    label: "Average trading days duration - cumulative",
    legendLabel: "Average trading days duration",
    category: "Time Analysis",
    valueType: "duration",
    chartType: "area",
    signed: false,
  },
  {
    id: "avg_hold_time_cumulative",
    label: "Avg hold time - cumulative",
    legendLabel: "Avg hold time",
    category: "Time Analysis",
    valueType: "duration",
    chartType: "area",
    signed: false,
  },
  {
    id: "longest_trade_duration_cumulative",
    label: "Longest trade duration - cumulative",
    legendLabel: "Longest trade duration",
    category: "Time Analysis",
    valueType: "duration",
    chartType: "area",
    signed: false,
  },
  {
    id: "max_trading_days_duration_cumulative",
    label: "Max trading days duration - cumulative",
    legendLabel: "Max trading days duration",
    category: "Time Analysis",
    valueType: "duration",
    chartType: "area",
    signed: false,
  },

  // Profitability
  {
    id: "net_pnl_cumulative",
    label: "Net P&L - cumulative",
    legendLabel: "Net P&L",
    category: "Profitability",
    valueType: "currency",
    chartType: "signedArea",
    signed: true,
  },
  {
    id: "avg_daily_net_pnl_cumulative",
    label: "Avg daily net P&L - cumulative",
    legendLabel: "Avg daily net P&L",
    category: "Profitability",
    valueType: "currency",
    chartType: "signedArea",
    signed: true,
  },
  {
    id: "avg_daily_win_loss_cumulative",
    label: "Avg daily win/loss - cumulative",
    legendLabel: "Avg daily win/loss",
    category: "Profitability",
    valueType: "ratio",
    chartType: "bar",
    signed: false,
  },
  {
    id: "avg_loss_cumulative",
    label: "Avg loss - cumulative",
    legendLabel: "Avg loss",
    category: "Profitability",
    valueType: "currency",
    chartType: "signedArea",
    signed: true,
  },
  {
    id: "avg_max_trade_loss_cumulative",
    label: "Avg max trade loss - cumulative",
    legendLabel: "Avg max trade loss",
    category: "Profitability",
    valueType: "currency",
    chartType: "signedArea",
    signed: true,
  },
  {
    id: "avg_max_trade_profit_cumulative",
    label: "Avg max trade profit - cumulative",
    legendLabel: "Avg max trade profit",
    category: "Profitability",
    valueType: "currency",
    chartType: "area",
    signed: false,
  },
  {
    id: "avg_net_trade_pnl_cumulative",
    label: "Avg net trade P&L - cumulative",
    legendLabel: "Avg net trade P&L",
    category: "Profitability",
    valueType: "currency",
    chartType: "signedArea",
    signed: true,
  },
  {
    id: "avg_trade_win_loss_cumulative",
    label: "Avg trade win/loss - cumulative",
    legendLabel: "Avg trade win/loss",
    category: "Profitability",
    valueType: "ratio",
    chartType: "area",
    signed: false,
  },
  {
    id: "avg_win_cumulative",
    label: "Avg win - cumulative",
    legendLabel: "Avg win",
    category: "Profitability",
    valueType: "currency",
    chartType: "area",
    signed: false,
  },
  {
    id: "daily_net_pnl",
    label: "Daily net P&L",
    legendLabel: "Daily net P&L",
    category: "Profitability",
    valueType: "currency",
    chartType: "bar",
    signed: true,
  },
  {
    id: "profit_factor_cumulative",
    label: "Profit factor - cumulative",
    legendLabel: "Profit factor",
    category: "Profitability",
    valueType: "ratio",
    chartType: "area",
    signed: false,
  },
  {
    id: "expectancy_cumulative",
    label: "Expectancy - cumulative",
    legendLabel: "Expectancy",
    category: "Profitability",
    valueType: "currency",
    chartType: "signedArea",
    signed: true,
  },
  {
    id: "largest_win_cumulative",
    label: "Largest win - cumulative",
    legendLabel: "Largest win",
    category: "Profitability",
    valueType: "currency",
    chartType: "area",
    signed: false,
  },
  {
    id: "largest_loss_cumulative",
    label: "Largest loss - cumulative",
    legendLabel: "Largest loss",
    category: "Profitability",
    valueType: "currency",
    chartType: "signedArea",
    signed: true,
  },

  // Risk & Drawdown
  {
    id: "drawdown",
    label: "Drawdown",
    legendLabel: "Drawdown",
    category: "Risk & Drawdown",
    valueType: "currency",
    chartType: "signedArea",
    signed: true,
  },
  {
    id: "max_drawdown_cumulative",
    label: "Max drawdown - cumulative",
    legendLabel: "Max drawdown",
    category: "Risk & Drawdown",
    valueType: "currency",
    chartType: "area",
    signed: false,
  },
  {
    id: "max_drawdown_pct_cumulative",
    label: "Max drawdown % - cumulative",
    legendLabel: "Max drawdown %",
    category: "Risk & Drawdown",
    valueType: "percent",
    chartType: "area",
    signed: false,
  },

  // Trading Activity & Volume
  {
    id: "avg_daily_volume_cumulative",
    label: "Avg daily volume - cumulative",
    legendLabel: "Avg daily volume",
    category: "Trading Activity & Volume",
    valueType: "count",
    chartType: "area",
    signed: false,
  },
  {
    id: "daily_net_drawdown_cumulative",
    label: "Daily net drawdown - cumulative",
    legendLabel: "Daily net drawdown",
    category: "Trading Activity & Volume",
    valueType: "currency",
    chartType: "signedArea",
    signed: true,
  },
  {
    id: "logged_days_cumulative",
    label: "Logged days - cumulative",
    legendLabel: "Logged days",
    category: "Trading Activity & Volume",
    valueType: "count",
    chartType: "area",
    signed: false,
  },
  {
    id: "longs_breakeven_cumulative",
    label: "Longs # of breakeven trades - cumulative",
    legendLabel: "Longs # of breakeven trades",
    category: "Trading Activity & Volume",
    valueType: "count",
    chartType: "area",
    signed: false,
  },
  {
    id: "longs_losing_cumulative",
    label: "Longs # of losing trades - cumulative",
    legendLabel: "Longs # of losing trades",
    category: "Trading Activity & Volume",
    valueType: "count",
    chartType: "area",
    signed: false,
  },
  {
    id: "longs_open_cumulative",
    label: "Longs # of open trades - cumulative",
    legendLabel: "Longs # of open trades",
    category: "Trading Activity & Volume",
    valueType: "count",
    chartType: "area",
    signed: false,
  },
  {
    id: "longs_trades_cumulative",
    label: "Longs # of trades - cumulative",
    legendLabel: "Longs # of trades",
    category: "Trading Activity & Volume",
    valueType: "count",
    chartType: "area",
    signed: false,
  },
  {
    id: "longs_winning_cumulative",
    label: "Longs # of winning trades - cumulative",
    legendLabel: "Longs # of winning trades",
    category: "Trading Activity & Volume",
    valueType: "count",
    chartType: "area",
    signed: false,
  },
  {
    id: "net_account_balance",
    label: "Net account balance",
    legendLabel: "Net account balance",
    category: "Trading Activity & Volume",
    valueType: "currency",
    chartType: "signedArea",
    signed: true,
  },
  {
    id: "open_trades_cumulative",
    label: "Open trades - cumulative",
    legendLabel: "Open trades",
    category: "Trading Activity & Volume",
    valueType: "count",
    chartType: "area",
    signed: false,
  },
  {
    id: "shorts_breakeven_cumulative",
    label: "Shorts # of breakeven trades - cumulative",
    legendLabel: "Shorts # of breakeven trades",
    category: "Trading Activity & Volume",
    valueType: "count",
    chartType: "area",
    signed: false,
  },
  {
    id: "shorts_losing_cumulative",
    label: "Shorts # of losing trades - cumulative",
    legendLabel: "Shorts # of losing trades",
    category: "Trading Activity & Volume",
    valueType: "count",
    chartType: "area",
    signed: false,
  },
  {
    id: "shorts_winning_cumulative",
    label: "Shorts # of winning trades - cumulative",
    legendLabel: "Shorts # of winning trades",
    category: "Trading Activity & Volume",
    valueType: "count",
    chartType: "area",
    signed: false,
  },
  {
    id: "shorts_trades_cumulative",
    label: "Shorts # of trades - cumulative",
    legendLabel: "Shorts # of trades",
    category: "Trading Activity & Volume",
    valueType: "count",
    chartType: "area",
    signed: false,
  },
  {
    id: "shorts_open_cumulative",
    label: "Shorts # of open trades - cumulative",
    legendLabel: "Shorts # of open trades",
    category: "Trading Activity & Volume",
    valueType: "count",
    chartType: "area",
    signed: false,
  },
  {
    id: "volume_cumulative",
    label: "Volume - cumulative",
    legendLabel: "Volume",
    category: "Trading Activity & Volume",
    valueType: "count",
    chartType: "area",
    signed: false,
  },
  {
    id: "trades_cumulative",
    label: "Trades - cumulative",
    legendLabel: "Trades",
    category: "Trading Activity & Volume",
    valueType: "count",
    chartType: "area",
    signed: false,
  },

  // Streaks & Consistency
  {
    id: "win_streak",
    label: "Win streak",
    legendLabel: "Win streak",
    category: "Streaks & Consistency",
    valueType: "count",
    chartType: "area",
    signed: false,
  },
  {
    id: "loss_streak",
    label: "Loss streak",
    legendLabel: "Loss streak",
    category: "Streaks & Consistency",
    valueType: "count",
    chartType: "area",
    signed: false,
  },
  {
    id: "max_win_streak_cumulative",
    label: "Max win streak - cumulative",
    legendLabel: "Max win streak",
    category: "Streaks & Consistency",
    valueType: "count",
    chartType: "area",
    signed: false,
  },
  {
    id: "max_loss_streak_cumulative",
    label: "Max loss streak - cumulative",
    legendLabel: "Max loss streak",
    category: "Streaks & Consistency",
    valueType: "count",
    chartType: "area",
    signed: false,
  },
  {
    id: "win_rate_cumulative",
    label: "Win rate - cumulative",
    legendLabel: "Win rate",
    category: "Streaks & Consistency",
    valueType: "percent",
    chartType: "area",
    signed: false,
  },
];

const METRIC_DESCRIPTIONS: Record<string, string> = {
  avg_trading_days_duration_cumulative:
    "Running average of how long your trading days last through the selected range.",
  avg_hold_time_cumulative: "Running average of how long closed trades stay open.",
  longest_trade_duration_cumulative: "The longest a single trade stayed open, tracked as a running maximum.",
  max_trading_days_duration_cumulative: "The longest trading day so far in the selected range.",
  net_pnl_cumulative:
    "Running total of net profit and loss. Above zero is profit and below zero is loss.",
  avg_daily_net_pnl_cumulative: "Running average of net P&L per trading day.",
  avg_daily_win_loss_cumulative: "Running ratio of the average winning day to the average losing day.",
  avg_loss_cumulative: "Running average size of your losing trades.",
  avg_max_trade_loss_cumulative: "Running average of the largest loss in each period.",
  avg_max_trade_profit_cumulative: "Running average of the largest profit in each period.",
  avg_net_trade_pnl_cumulative: "Running average net P&L per closed trade.",
  avg_trade_win_loss_cumulative: "Running ratio of the average winner to the average loser.",
  avg_win_cumulative: "Running average size of your winning trades.",
  daily_net_pnl:
    "Net P&L for each day. Green is a profitable day and red is a losing day. Use it to spot streaks.",
  profit_factor_cumulative:
    "Running gross profit divided by gross loss. Above 1 means profits are greater than losses.",
  expectancy_cumulative: "Running estimate of the average amount you gain or lose per trade.",
  largest_win_cumulative: "The biggest winning trade so far in the range.",
  largest_loss_cumulative: "The biggest losing trade so far in the range.",
  drawdown: "Decline from the previous equity peak. Use it to see how deep and how long losing periods last.",
  max_drawdown_cumulative: "The deepest decline from a peak reached so far.",
  max_drawdown_pct_cumulative: "That deepest decline as a percentage of the peak it fell from.",
  avg_daily_volume_cumulative: "Running average of size traded per day.",
  daily_net_drawdown_cumulative: "Running net drawdown from the equity peak.",
  logged_days_cumulative: "Count of days with journal activity, accumulated through the range.",
  longs_breakeven_cumulative: "Running count of long trades that closed flat.",
  longs_losing_cumulative: "Running count of long trades that closed at a loss.",
  longs_open_cumulative: "Running count of long trades that are still open.",
  longs_trades_cumulative: "Running count of long trades.",
  longs_winning_cumulative: "Running count of long trades that closed in profit.",
  net_account_balance: "Account balance after closed P&L in the selected range.",
  open_trades_cumulative: "Running count of trades that are still open.",
  shorts_breakeven_cumulative: "Running count of short trades that closed flat.",
  shorts_losing_cumulative: "Running count of short trades that closed at a loss.",
  shorts_winning_cumulative: "Running count of short trades that closed in profit.",
  shorts_trades_cumulative: "Running count of short trades.",
  shorts_open_cumulative: "Running count of short trades that are still open.",
  volume_cumulative: "Running total of size traded.",
  trades_cumulative: "Running count of trades taken.",
  win_streak: "The current run of consecutive winning trades.",
  loss_streak: "The current run of consecutive losing trades.",
  max_win_streak_cumulative: "The longest run of winning trades so far.",
  max_loss_streak_cumulative: "The longest run of losing trades so far.",
  win_rate_cumulative:
    "Running percentage of closed trades that were profitable. Compare it with average win and average loss.",
};

const BY_ID = new Map(REPORT_METRICS.map((m) => [m.id, m]));

export function getReportMetric(id: string): ReportMetricDef {
  const metric = BY_ID.get(id) ?? BY_ID.get(DEFAULT_REPORT_METRIC_ID)!;
  return { ...metric, description: METRIC_DESCRIPTIONS[metric.id] };
}

export function metricsByCategory(): { category: ReportMetricCategory; metrics: ReportMetricDef[] }[] {
  const grouped = new Map<ReportMetricCategory, ReportMetricDef[]>();
  for (const metric of REPORT_METRICS) {
    const list = grouped.get(metric.category);
    if (list) list.push(metric);
    else grouped.set(metric.category, [metric]);
  }
  return REPORT_METRIC_CATEGORIES.map((category) => ({
    category,
    metrics: grouped.get(category) ?? [],
  }));
}

export function searchReportMetrics(query: string): { category: ReportMetricCategory; metrics: ReportMetricDef[] }[] {
  const q = query.trim().toLowerCase();
  if (!q) return metricsByCategory();
  return metricsByCategory()
    .map((group) => ({
      category: group.category,
      metrics: group.metrics.filter(
        (m) =>
          m.label.toLowerCase().includes(q) ||
          m.legendLabel.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q)
      ),
    }))
    .filter((group) => group.metrics.length > 0);
}
