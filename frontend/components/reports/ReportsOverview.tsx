"use client";

import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { MoodPnlChart } from "@/components/charts/MoodPnlChart";
import { SetupTable } from "@/components/charts/SetupTable";
import { TimeBucketChart } from "@/components/charts/TimeBucketChart";
import { PNL_LOSS_HEX, PNL_PROFIT_HEX } from "@/lib/appearance";
import type { AnalyticsResponse, EdgeFinder, EquityPoint, TagExpectancy, TimeBucketStat } from "@/lib/types";

const AXIS = { fontSize: 10, fill: "var(--color-chart-axis)" };
const CHART_H = 220;
const TOOLTIP = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 11,
  boxShadow: "var(--shadow-dropdown)",
  padding: "6px 10px",
  color: "var(--color-text-primary)",
};

export function ReportsOverview({
  data,
  formatMoney,
  accentHex,
  empty,
  goals,
  showEquity = true,
}: {
  data: AnalyticsResponse;
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
  accentHex: string;
  empty: boolean;
  goals?: ReactNode;
  showEquity?: boolean;
}) {
  const {
    overview,
    by_hour,
    by_day_of_week,
    by_setup,
    by_symbol,
    by_session,
    mood_vs_pnl,
    equity_curve,
    r_distribution,
    expectancy_by_tag,
    edge_finder,
    performance_timeline,
  } = data;

  return (
    <div className="space-y-3">
      {empty ? (
        <div className="dash-card px-4 py-6 text-sm text-[var(--color-text-secondary)]">
          No closed trades yet on this account. Add or close trades in your journal and these charts will fill in
          automatically.
        </div>
      ) : null}

      {goals}

      {edge_finder ? <EdgeFinderCard edge={edge_finder} formatMoney={formatMoney} /> : null}

      <div className="grid grid-cols-2 items-stretch gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Kpi label="Total trades" value={String(overview.total_trades)} />
        <Kpi label="Win rate" value={`${overview.win_rate}%`} />
        <Kpi
          label="Total P&L"
          value={formatMoney(overview.total_pnl)}
          tone={overview.total_pnl >= 0 ? "pos" : "neg"}
        />
        <Kpi label="Profit factor" value={overview.profit_factor ? overview.profit_factor.toFixed(2) : "—"} />
        <Kpi label="Avg win" value={formatMoney(overview.avg_win)} tone="pos" />
        <Kpi label="Avg loss" value={formatMoney(overview.avg_loss)} tone="neg" />
        <Kpi label="Expectancy" value={formatMoney(overview.expectancy)} />
        <Kpi label="Trading days" value={String(overview.trading_days)} />
        <Kpi label="Best day" value={formatMoney(overview.best_day_pnl)} tone="pos" />
        <Kpi label="Worst day" value={formatMoney(overview.worst_day_pnl)} tone="neg" />
        <Kpi label="Largest win" value={formatMoney(overview.largest_win)} tone="pos" />
        <Kpi label="Largest loss" value={formatMoney(overview.largest_loss)} tone="neg" />
        <Kpi label="Max drawdown" value={formatMoney(-(overview.max_drawdown ?? 0))} tone="neg" />
        <Kpi
          label="Max DD %"
          value={overview.max_drawdown_pct != null ? `${overview.max_drawdown_pct.toFixed(1)}%` : "—"}
          tone="neg"
        />
        <Kpi
          label="Avg execution"
          value={
            overview.avg_execution_score != null ? `${Math.round(overview.avg_execution_score)}/100` : "—"
          }
        />
        <Kpi
          label="Avg R"
          value={overview.avg_r_multiple != null ? `${overview.avg_r_multiple.toFixed(2)}R` : "—"}
        />
        <Kpi
          label="Current streak"
          value={
            overview.current_streak > 0 && overview.current_streak_type !== "none"
              ? `${overview.current_streak} ${overview.current_streak_type}${overview.current_streak === 1 ? "" : "s"}`
              : "—"
          }
        />
        <Kpi label="Total fees" value={formatMoney(overview.total_fees, { signed: false })} />
      </div>

      <ExpectancyTable rows={expectancy_by_tag} formatMoney={formatMoney} />

      {showEquity ? (
        <EquityCurveChart series={equity_curve} formatMoney={formatMoney} />
      ) : null}

      <div className="grid items-stretch gap-3 lg:grid-cols-2">
        <Panel title="R distribution" subtitle="Closed trades by R-multiple bucket">
          <ChartBody>
            {(r_distribution?.length ?? 0) === 0 ? (
              <EmptyChart text="Add risk amounts to see R distribution." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={r_distribution} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-chart-grid)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="bucket" tick={AXIS} tickLine={false} axisLine={false} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
                  <Tooltip contentStyle={TOOLTIP} />
                  <Bar dataKey="count" fill={accentHex} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartBody>
        </Panel>

        <Panel title="By session" subtitle="Asia / London / NY / Overlap">
          <ChartBody>
            {(by_session?.length ?? 0) === 0 ? (
              <EmptyChart text="No session data yet." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={by_session} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-chart-grid)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="bucket" tick={AXIS} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={AXIS}
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    tickFormatter={(v) => formatMoney(Number(v), { signed: true, digits: 0 })}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP}
                    formatter={(v: number, name: string) =>
                      name === "pnl" ? [formatMoney(v), "P&L"] : [v, name]
                    }
                  />
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                    {by_session.map((row) => (
                      <Cell key={row.bucket} fill={row.pnl >= 0 ? PNL_PROFIT_HEX : PNL_LOSS_HEX} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartBody>
        </Panel>
      </div>

      <Panel title="Performance timeline" subtitle="Monthly execution, health, and P&L">
        {(performance_timeline?.length ?? 0) === 0 ? (
          <p className="flex h-[120px] items-center text-[12px] text-[var(--color-text-muted)]">
            Not enough history for a monthly timeline.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--color-border-subtle)] text-[11px] font-medium text-[var(--color-text-muted)]">
                  <th className="pb-2 font-medium">Month</th>
                  <th className="pb-2 font-medium">Trades</th>
                  <th className="pb-2 font-medium">Execution</th>
                  <th className="pb-2 font-medium">Health</th>
                  <th className="pb-2 text-right font-medium">P&L</th>
                </tr>
              </thead>
              <tbody>
                {performance_timeline.map((row) => (
                  <tr key={row.month} className="border-b border-[var(--color-border-subtle)] last:border-0">
                    <td className="py-2.5 text-[var(--color-text-primary)]">{row.month}</td>
                    <td className="py-2.5 text-[var(--color-text-secondary)]">{row.trades}</td>
                    <td className="py-2.5 text-[var(--color-text-secondary)]">
                      {row.execution != null ? Math.round(row.execution) : "—"}
                    </td>
                    <td className="py-2.5 text-[var(--color-text-secondary)]">
                      {row.health != null ? Math.round(row.health) : "—"}
                    </td>
                    <td
                      className="py-2.5 text-right font-medium tabular-nums"
                      style={{ color: row.pnl >= 0 ? PNL_PROFIT_HEX : PNL_LOSS_HEX }}
                    >
                      {formatMoney(row.pnl)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid items-stretch gap-3 lg:grid-cols-2">
        <Panel title="Win rate by hour" subtitle="Where your edge actually lives">
          <ChartBody>
            <TimeBucketChart data={by_hour} />
          </ChartBody>
        </Panel>
        <Panel title="Win rate by day of week">
          <ChartBody>
            <TimeBucketChart data={by_day_of_week} />
          </ChartBody>
        </Panel>
      </div>

      <Panel title="Setup performance" subtitle="30-day rolling win rate per tagged setup">
        <SetupTable setups={by_setup} formatMoney={formatMoney} />
      </Panel>

      <Panel title="Symbol performance" subtitle="Top symbols by absolute P&L">
        {(by_symbol?.length ?? 0) === 0 ? (
          <p className="text-[12px] text-[var(--color-text-muted)]">No closed trades with symbols yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--color-border-subtle)] text-[11px] font-medium text-[var(--color-text-muted)]">
                  <th className="pb-2 font-medium">Symbol</th>
                  <th className="pb-2 font-medium">Trades</th>
                  <th className="pb-2 font-medium">Win rate</th>
                  <th className="pb-2 text-right font-medium">P&L</th>
                </tr>
              </thead>
              <tbody>
                {by_symbol.map((row) => (
                  <tr key={row.bucket} className="border-b border-[var(--color-border-subtle)] last:border-0">
                    <td className="py-2.5 font-mono text-[var(--color-text-primary)]">{row.bucket}</td>
                    <td className="py-2.5 text-[var(--color-text-secondary)]">{row.trades}</td>
                    <td className="py-2.5 text-[var(--color-text-secondary)]">{row.win_rate}%</td>
                    <td
                      className="py-2.5 text-right font-medium tabular-nums"
                      style={{ color: row.pnl >= 0 ? PNL_PROFIT_HEX : PNL_LOSS_HEX }}
                    >
                      {formatMoney(row.pnl)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Mood vs P&L" subtitle="What mental state actually pays">
        <ChartBody>
          <MoodPnlChart data={mood_vs_pnl} />
        </ChartBody>
      </Panel>
    </div>
  );
}

function EquityCurveChart({
  series,
  formatMoney,
}: {
  series: EquityPoint[];
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
}) {
  const last = series[series.length - 1]?.value ?? 0;
  const stroke = last < 0 ? PNL_LOSS_HEX : PNL_PROFIT_HEX;

  return (
    <Panel title="Equity curve" subtitle="Cumulative P&L from closed trades">
      <ChartBody>
        {series.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="reportsEquityFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.32} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-chart-grid)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tick={AXIS}
                tickLine={false}
                axisLine={false}
                minTickGap={36}
                tickFormatter={(iso: string) => {
                  const parts = String(iso).split("-");
                  if (parts.length < 3) return String(iso);
                  return `${parts[1]}/${parts[2]}`;
                }}
              />
              <YAxis
                tick={AXIS}
                tickLine={false}
                axisLine={false}
                width={72}
                tickFormatter={(v) => formatMoney(Number(v), { signed: true, digits: 0 })}
              />
              <Tooltip
                contentStyle={TOOLTIP}
                formatter={(v: number) => [formatMoney(v), "P&L"]}
                labelFormatter={(label) => String(label)}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={stroke}
                fill="url(#reportsEquityFill)"
                strokeWidth={2}
                dot={false}
                name="P&L"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart text="Need at least two closed trades to draw the equity curve." />
        )}
      </ChartBody>
    </Panel>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="dash-card flex h-full min-w-0 flex-col p-3.5">
      <div className="mb-2 flex h-11 shrink-0 flex-col justify-center">
        <h3 className="truncate text-[12px] font-medium leading-4 text-[var(--color-text-primary)]">{title}</h3>
        {subtitle ? (
          <p className="mt-0.5 truncate text-[11px] leading-4 text-[var(--color-text-muted)]">{subtitle}</p>
        ) : (
          <p className="mt-0.5 h-4 text-[11px]" aria-hidden>
            &nbsp;
          </p>
        )}
      </div>
      <div className="min-h-0 min-w-0 flex-1">{children}</div>
    </section>
  );
}

function ChartBody({ children }: { children: ReactNode }) {
  return (
    <div className="w-full min-w-0" style={{ height: CHART_H }}>
      {children}
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
}) {
  const color =
    tone === "pos" ? PNL_PROFIT_HEX : tone === "neg" ? PNL_LOSS_HEX : "var(--color-text-kpi)";
  return (
    <article className="dash-card flex h-[88px] flex-col justify-start p-3.5">
      <p className="text-[11px] font-medium leading-4 text-[var(--color-text-label)]">{label}</p>
      <p className="mt-1.5 truncate text-[16px] font-semibold leading-6 tracking-tight tabular-nums" style={{ color }}>
        {value}
      </p>
    </article>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <p className="flex h-full items-center justify-center text-[12px] text-[var(--color-text-muted)]">{text}</p>
  );
}

function EdgeFinderCard({
  edge,
  formatMoney,
}: {
  edge: EdgeFinder;
  formatMoney: (n: number, opts?: { signed?: boolean }) => string;
}) {
  const items: { label: string; value: string; tone?: "pos" | "neg" }[] = [
    { label: "Best day", value: formatBucket(edge.best_day, formatMoney), tone: "pos" },
    { label: "Best hour", value: formatBucket(edge.best_hour, formatMoney), tone: "pos" },
    { label: "Best setup", value: formatTag(edge.best_setup, formatMoney), tone: "pos" },
    { label: "Worst symbol", value: formatBucket(edge.worst_symbol, formatMoney), tone: "neg" },
    { label: "Worst emotion", value: formatTag(edge.worst_emotion, formatMoney), tone: "neg" },
  ];

  return (
    <Panel title="Edge Finder" subtitle="Where your edge concentrates — and where it leaks">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-secondary)] px-3 py-2.5"
          >
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              {item.label}
            </p>
            <p
              className="mt-1 text-[12px] font-medium leading-4 text-[var(--color-text-primary)]"
              style={{
                color: item.tone === "pos" ? PNL_PROFIT_HEX : item.tone === "neg" ? PNL_LOSS_HEX : undefined,
              }}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function formatBucket(
  row: TimeBucketStat | null | undefined,
  formatMoney: (n: number) => string
): string {
  if (!row) return "—";
  return `${row.bucket} · ${formatMoney(row.pnl)} · ${row.win_rate}% WR`;
}

function formatTag(
  row: TagExpectancy | null | undefined,
  formatMoney: (n: number) => string
): string {
  if (!row) return "—";
  return `${row.tag} · ${formatMoney(row.expectancy)} exp`;
}

function ExpectancyTable({
  rows,
  formatMoney,
}: {
  rows: TagExpectancy[];
  formatMoney: (n: number) => string;
}) {
  return (
    <Panel title="Expectancy by tag" subtitle="Setup tags ranked by expectancy">
      {rows.length === 0 ? (
        <p className="text-[12px] text-[var(--color-text-muted)]">Tag setups on closed trades to see expectancy.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--color-border-subtle)] text-[11px] font-medium text-[var(--color-text-muted)]">
                <th className="pb-2 font-medium">Tag</th>
                <th className="pb-2 font-medium">Trades</th>
                <th className="pb-2 font-medium">Win rate</th>
                <th className="pb-2 font-medium">Expectancy</th>
                <th className="pb-2 font-medium">Avg R</th>
                <th className="pb-2 text-right font-medium">P&L</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.tag_type}-${row.tag}`} className="border-b border-[var(--color-border-subtle)] last:border-0">
                  <td className="py-2.5 text-[var(--color-text-primary)]">{row.tag}</td>
                  <td className="py-2.5 text-[var(--color-text-secondary)]">{row.trades}</td>
                  <td className="py-2.5 text-[var(--color-text-secondary)]">{row.win_rate}%</td>
                  <td className="py-2.5 font-mono text-[var(--color-text-secondary)]">
                    {formatMoney(row.expectancy)}
                  </td>
                  <td className="py-2.5 text-[var(--color-text-secondary)]">
                    {row.avg_r != null ? `${row.avg_r.toFixed(2)}R` : "—"}
                  </td>
                  <td
                    className="py-2.5 text-right font-medium tabular-nums"
                    style={{ color: row.pnl >= 0 ? PNL_PROFIT_HEX : PNL_LOSS_HEX }}
                  >
                    {formatMoney(row.pnl)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
