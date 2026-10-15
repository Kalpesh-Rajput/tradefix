import type { ReactNode } from "react";

import type { RunBreakdowns, RunTrade } from "@/lib/hooks/useBacktestRuns";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const BUCKETS = [-2, -1, 0, 1, 2, 3];

export function ResultBreakdowns({
  trades,
  equity,
  breakdowns,
}: {
  trades: RunTrade[];
  equity: { t: number; v: number }[];
  breakdowns?: RunBreakdowns | null;
}) {
  const stored = breakdowns ?? fallbackBreakdowns(trades, equity);
  const byDay = stored.weekday_pnl;
  const byHour = stored.hour_pnl;
  const months = stored.monthly;
  const counts = stored.r_histogram;

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Panel title="Weekday P&L">
        <Bars labels={WEEKDAYS} values={byDay} />
      </Panel>
      <Panel title="Hour P&L (UTC)">
        <Bars labels={byHour.map((_, hour) => String(hour))} values={byHour} />
      </Panel>
      <Panel title="Monthly change">
        {months.length === 0 ? <p className="text-sm text-muted">No monthly points yet.</p> : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {months.map((point) => (
              <li key={point.month} className={`rounded-lg px-2 py-2 text-xs ${point.change >= 0 ? "bg-[color-mix(in_srgb,var(--color-chart-profit)_18%,transparent)]" : "bg-[color-mix(in_srgb,var(--color-chart-loss)_18%,transparent)]"}`}>
                <span className="block text-muted">{point.month}</span>
                <span className={point.change >= 0 ? "text-positive" : "text-negative"}>{point.change.toFixed(0)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="R-multiple distribution">
        <Bars labels={BUCKETS.map((start) => `${start}+`)} values={counts} />
      </Panel>
    </div>
  );
}

function fallbackBreakdowns(trades: RunTrade[], equity: { t: number; v: number }[]): RunBreakdowns {
  const weekday = new Array(7).fill(0);
  const hour = new Array(24).fill(0);
  for (const trade of trades) {
    const date = new Date(trade.entry_ms);
    weekday[date.getUTCDay() === 0 ? 6 : date.getUTCDay() - 1] += trade.pnl;
    hour[date.getUTCHours()] += trade.pnl;
  }
  const monthly: RunBreakdowns["monthly"] = [];
  for (let index = 1; index < equity.length; index += 1) {
    const month = new Date(equity[index].t).toISOString().slice(0, 7);
    const change = equity[index].v - equity[index - 1].v;
    const existing = monthly.find((point) => point.month === month);
    if (existing) existing.change += change;
    else monthly.push({ month, change });
  }
  const rs = trades.map((trade) => trade.r_multiple).filter((value): value is number => value != null);
  const histogram = BUCKETS.map((start, index) => {
    const end = BUCKETS[index + 1] ?? 99;
    return rs.filter((value) => value >= start && value < end).length;
  });
  return { weekday_pnl: weekday, hour_pnl: hour, monthly, r_histogram: histogram, drawdown: [] };
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="dash-card p-4">
      <h2 className="mb-3 text-sm font-medium text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Bars({ labels, values }: { labels: string[]; values: number[] }) {
  const peak = Math.max(...values.map((value) => Math.abs(value)), 1);
  return (
    <div className="flex items-end gap-1 overflow-x-auto">
      {values.map((value, index) => (
        <div key={labels[index]} className="flex min-w-6 flex-1 flex-col items-center gap-1">
          <div className="flex h-16 w-full items-end">
            <div
              className={`w-full rounded-sm ${value >= 0 ? "bg-[var(--color-chart-profit)]" : "bg-[var(--color-chart-loss)]"}`}
              style={{ height: `${(Math.abs(value) / peak) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-muted">{labels[index]}</span>
        </div>
      ))}
    </div>
  );
}
