"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { MoodPnlChart } from "@/components/charts/MoodPnlChart";
import { SetupTable } from "@/components/charts/SetupTable";
import { TimeBucketChart } from "@/components/charts/TimeBucketChart";
import { GoalsProgressCard } from "@/components/dashboard/GoalsProgressCard";
import { ShareCard } from "@/components/share/ShareCard";
import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { useAppearance } from "@/components/providers/AppearanceProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { buildGoalProgress } from "@/lib/goals";
import { useAnalytics } from "@/lib/hooks/useAnalytics";
import { useTrades } from "@/lib/hooks/useTrades";
import type { EdgeFinder, TagExpectancy, TimeBucketStat } from "@/lib/types";

const SESSIONS = ["", "Asia", "London", "NY", "Overlap"] as const;

export default function AnalyticsPage() {
  const { user } = useAuth();
  const { activeAccount, displayPnl, formatMoney, loading: accountsLoading } = useAccountPrefs();
  const { formatChartDate } = useLocale();
  const { accentHex } = useAppearance();
  const accountId = activeAccount?.id;

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [session, setSession] = useState("");
  const [symbol, setSymbol] = useState("");

  const accountReady = !!accountId;
  const filters = useMemo(
    () => ({
      account_id: accountId,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      session: session || undefined,
      symbol: symbol.trim() || undefined,
    }),
    [accountId, dateFrom, dateTo, session, symbol]
  );

  const { data, isLoading, isError, refetch } = useAnalytics(filters, { enabled: accountReady });
  const { data: trades = [] } = useTrades(
    { account_id: accountId },
    { enabled: accountReady }
  );

  const goalItems = useMemo(
    () => buildGoalProgress(user, trades, displayPnl),
    [user, trades, displayPnl]
  );

  const equitySeries = useMemo(() => {
    if (!data?.equity_curve?.length) return [];
    return data.equity_curve.map((p) => ({
      date: formatChartDate(new Date(p.date + "T12:00:00")),
      value: p.value,
    }));
  }, [data?.equity_curve, formatChartDate]);

  if (accountsLoading || isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-80" />
        </div>
        <Skeleton className="h-14" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <h1 className="text-2xl font-semibold text-white">Analytics</h1>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-zinc-300">
          Couldn’t load analytics.{" "}
          <button type="button" onClick={() => refetch()} className="text-primary hover:underline">
            Try again
          </button>
        </div>
      </div>
    );
  }

  const {
    overview,
    by_hour,
    by_day_of_week,
    by_setup,
    by_symbol,
    by_session,
    mood_vs_pnl,
    r_distribution,
    expectancy_by_tag,
    edge_finder,
    performance_timeline,
  } = data;
  const empty = overview.total_trades === 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Analytics</h1>
          <p className="mt-1 text-sm text-gray-400">
            {activeAccount
              ? `Live metrics for ${activeAccount.name} — calculated from your closed trades.`
              : "Live metrics calculated from your closed trades."}
          </p>
        </div>
        <ShareCard
          overview={overview}
          formatMoney={formatMoney}
          accountName={activeAccount?.name}
        />
      </div>

      <FilterBar
        dateFrom={dateFrom}
        dateTo={dateTo}
        session={session}
        symbol={symbol}
        onDateFrom={setDateFrom}
        onDateTo={setDateTo}
        onSession={setSession}
        onSymbol={setSymbol}
        onClear={() => {
          setDateFrom("");
          setDateTo("");
          setSession("");
          setSymbol("");
        }}
      />

      <GoalsProgressCard items={goalItems} title="Goals" emptyHint={false} />

      {empty ? (
        <Card>
          <p className="text-sm text-zinc-400">
            No closed trades yet on this account. Add or close trades in your journal and these charts will fill in
            automatically.
          </p>
        </Card>
      ) : null}

      {edge_finder ? <EdgeFinderCard edge={edge_finder} formatMoney={formatMoney} /> : null}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total trades" value={String(overview.total_trades)} />
        <StatCard label="Win rate" value={`${overview.win_rate}%`} />
        <StatCard
          label="Total P&L"
          value={formatMoney(overview.total_pnl)}
          tone={overview.total_pnl >= 0 ? "pos" : "neg"}
        />
        <StatCard
          label="Profit factor"
          value={overview.profit_factor ? overview.profit_factor.toFixed(2) : "—"}
        />
        <StatCard label="Avg win" value={formatMoney(overview.avg_win)} tone="pos" />
        <StatCard label="Avg loss" value={formatMoney(overview.avg_loss)} tone="neg" />
        <StatCard label="Expectancy" value={formatMoney(overview.expectancy)} />
        <StatCard label="Trading days" value={String(overview.trading_days)} />
        <StatCard label="Best day" value={formatMoney(overview.best_day_pnl)} tone="pos" />
        <StatCard label="Worst day" value={formatMoney(overview.worst_day_pnl)} tone="neg" />
        <StatCard label="Largest win" value={formatMoney(overview.largest_win)} tone="pos" />
        <StatCard label="Largest loss" value={formatMoney(overview.largest_loss)} tone="neg" />
        <StatCard
          label="Max drawdown"
          value={formatMoney(-(overview.max_drawdown ?? 0))}
          tone="neg"
        />
        <StatCard
          label="Max DD %"
          value={overview.max_drawdown_pct != null ? `${overview.max_drawdown_pct.toFixed(1)}%` : "—"}
          tone="neg"
        />
        <StatCard
          label="Avg execution"
          value={
            overview.avg_execution_score != null ? `${Math.round(overview.avg_execution_score)}/100` : "—"
          }
        />
        <StatCard
          label="Avg R"
          value={overview.avg_r_multiple != null ? `${overview.avg_r_multiple.toFixed(2)}R` : "—"}
        />
        <StatCard
          label="Current streak"
          value={
            overview.current_streak > 0 && overview.current_streak_type !== "none"
              ? `${overview.current_streak} ${overview.current_streak_type}${overview.current_streak === 1 ? "" : "s"}`
              : "—"
          }
        />
        <StatCard label="Total fees" value={formatMoney(overview.total_fees, { signed: false })} />
      </div>

      <ExpectancyTable rows={expectancy_by_tag} formatMoney={formatMoney} />

      <Card>
        <CardHeader title="Equity curve" subtitle="Cumulative P&L from closed trades" />
        <div className="h-56 w-full">
          {equitySeries.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equitySeries}>
                <defs>
                  <linearGradient id="analyticsPnlFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={accentHex} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={accentHex} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "#1c1c1f",
                    border: "1px solid #2a2a2e",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [formatMoney(v), "P&L"]}
                />
                <Area type="monotone" dataKey="value" stroke={accentHex} fill="url(#analyticsPnlFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-full items-center justify-center text-sm text-zinc-500">
              Need at least two closed trades to draw the equity curve.
            </p>
          )}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="R distribution" subtitle="Closed trades by R-multiple bucket" />
          <div className="h-48 w-full">
            {(r_distribution?.length ?? 0) === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-zinc-500">
                Add risk amounts to see R distribution.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={r_distribution}>
                  <XAxis dataKey="bucket" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "#1c1c1f",
                      border: "1px solid #2a2a2e",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" fill={accentHex} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="By session" subtitle="Asia / London / NY / Overlap" />
          <div className="h-48 w-full">
            {(by_session?.length ?? 0) === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-zinc-500">No session data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={by_session}>
                  <XAxis dataKey="bucket" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "#1c1c1f",
                      border: "1px solid #2a2a2e",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number, name: string) =>
                      name === "pnl" ? [formatMoney(v), "P&L"] : [v, name]
                    }
                  />
                  <Bar dataKey="pnl" fill={accentHex} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Performance timeline" subtitle="Monthly execution, health, and P&L" />
        {(performance_timeline?.length ?? 0) === 0 ? (
          <p className="text-sm text-zinc-500">Not enough history for a monthly timeline.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[11px] uppercase tracking-wider text-zinc-500">
                  <th className="pb-2 font-medium">Month</th>
                  <th className="pb-2 font-medium">Trades</th>
                  <th className="pb-2 font-medium">Execution</th>
                  <th className="pb-2 font-medium">Health</th>
                  <th className="pb-2 font-medium text-right">P&L</th>
                </tr>
              </thead>
              <tbody>
                {performance_timeline.map((row) => (
                  <tr key={row.month} className="border-b border-white/[0.04]">
                    <td className="py-2.5 text-white">{row.month}</td>
                    <td className="py-2.5 text-zinc-400">{row.trades}</td>
                    <td className="py-2.5 text-zinc-400">
                      {row.execution != null ? Math.round(row.execution) : "—"}
                    </td>
                    <td className="py-2.5 text-zinc-400">
                      {row.health != null ? Math.round(row.health) : "—"}
                    </td>
                    <td
                      className={`py-2.5 text-right font-mono ${
                        row.pnl >= 0 ? "text-positive" : "text-negative"
                      }`}
                    >
                      {formatMoney(row.pnl)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Win rate by hour of day" subtitle="Where your edge actually lives" />
        <TimeBucketChart data={by_hour} />
      </Card>

      <Card>
        <CardHeader title="Win rate by day of week" />
        <TimeBucketChart data={by_day_of_week} />
      </Card>

      <Card>
        <CardHeader title="Setup performance" subtitle="30-day rolling win rate per tagged setup" />
        <SetupTable setups={by_setup} />
      </Card>

      <Card>
        <CardHeader title="Symbol performance" subtitle="Top symbols by absolute P&L" />
        {(by_symbol?.length ?? 0) === 0 ? (
          <p className="text-sm text-zinc-500">No closed trades with symbols yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[11px] uppercase tracking-wider text-zinc-500">
                  <th className="pb-2 font-medium">Symbol</th>
                  <th className="pb-2 font-medium">Trades</th>
                  <th className="pb-2 font-medium">Win rate</th>
                  <th className="pb-2 font-medium text-right">P&L</th>
                </tr>
              </thead>
              <tbody>
                {by_symbol.map((row) => (
                  <tr key={row.bucket} className="border-b border-white/[0.04]">
                    <td className="py-2.5 font-mono text-white">{row.bucket}</td>
                    <td className="py-2.5 text-zinc-400">{row.trades}</td>
                    <td className="py-2.5 text-zinc-400">{row.win_rate}%</td>
                    <td
                      className={`py-2.5 text-right font-mono ${
                        row.pnl >= 0 ? "text-positive" : "text-negative"
                      }`}
                    >
                      {formatMoney(row.pnl)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Mood vs P&L" subtitle="What mental state actually pays" />
        <MoodPnlChart data={mood_vs_pnl} />
      </Card>
    </div>
  );
}

function FilterBar({
  dateFrom,
  dateTo,
  session,
  symbol,
  onDateFrom,
  onDateTo,
  onSession,
  onSymbol,
  onClear,
}: {
  dateFrom: string;
  dateTo: string;
  session: string;
  symbol: string;
  onDateFrom: (v: string) => void;
  onDateTo: (v: string) => void;
  onSession: (v: string) => void;
  onSymbol: (v: string) => void;
  onClear: () => void;
}) {
  const hasFilters = Boolean(dateFrom || dateTo || session || symbol);
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-white/[0.06] bg-zinc-950/80 p-3">
      <label className="space-y-1">
        <span className="block text-[10px] uppercase tracking-wider text-zinc-500">From</span>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFrom(e.target.value)}
          className="h-9 rounded-lg border border-white/10 bg-black px-2 text-sm text-white outline-none focus:border-primary/40"
        />
      </label>
      <label className="space-y-1">
        <span className="block text-[10px] uppercase tracking-wider text-zinc-500">To</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => onDateTo(e.target.value)}
          className="h-9 rounded-lg border border-white/10 bg-black px-2 text-sm text-white outline-none focus:border-primary/40"
        />
      </label>
      <label className="space-y-1">
        <span className="block text-[10px] uppercase tracking-wider text-zinc-500">Session</span>
        <select
          value={session}
          onChange={(e) => onSession(e.target.value)}
          className="h-9 rounded-lg border border-white/10 bg-black px-2 text-sm text-white outline-none focus:border-primary/40"
        >
          {SESSIONS.map((s) => (
            <option key={s || "all"} value={s}>
              {s || "All sessions"}
            </option>
          ))}
        </select>
      </label>
      <label className="min-w-[140px] flex-1 space-y-1">
        <span className="block text-[10px] uppercase tracking-wider text-zinc-500">Symbol</span>
        <input
          value={symbol}
          onChange={(e) => onSymbol(e.target.value)}
          placeholder="e.g. ES"
          className="h-9 w-full rounded-lg border border-white/10 bg-black px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-primary/40"
        />
      </label>
      {hasFilters ? (
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          Clear
        </Button>
      ) : null}
    </div>
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
    {
      label: "Best day",
      value: formatBucket(edge.best_day, formatMoney),
      tone: "pos",
    },
    {
      label: "Best hour",
      value: formatBucket(edge.best_hour, formatMoney),
      tone: "pos",
    },
    {
      label: "Best setup",
      value: formatTag(edge.best_setup, formatMoney),
      tone: "pos",
    },
    {
      label: "Worst symbol",
      value: formatBucket(edge.worst_symbol, formatMoney),
      tone: "neg",
    },
    {
      label: "Worst emotion",
      value: formatTag(edge.worst_emotion, formatMoney),
      tone: "neg",
    },
  ];

  return (
    <Card>
      <CardHeader title="Edge Finder" subtitle="Where your edge concentrates — and where it leaks" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((item) => (
          <div key={item.label} className="rounded-lg border border-white/[0.06] bg-black/40 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">{item.label}</p>
            <p
              className={`mt-1 text-sm font-medium ${
                item.tone === "pos" ? "text-positive" : item.tone === "neg" ? "text-negative" : "text-white"
              }`}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </Card>
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
    <Card>
      <CardHeader title="Expectancy by tag" subtitle="Setup tags ranked by expectancy" />
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">Tag setups on closed trades to see expectancy.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="pb-2 font-medium">Tag</th>
                <th className="pb-2 font-medium">Trades</th>
                <th className="pb-2 font-medium">Win rate</th>
                <th className="pb-2 font-medium">Expectancy</th>
                <th className="pb-2 font-medium">Avg R</th>
                <th className="pb-2 font-medium text-right">P&L</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.tag_type}-${row.tag}`} className="border-b border-white/[0.04]">
                  <td className="py-2.5 text-white">{row.tag}</td>
                  <td className="py-2.5 text-zinc-400">{row.trades}</td>
                  <td className="py-2.5 text-zinc-400">{row.win_rate}%</td>
                  <td className="py-2.5 font-mono text-zinc-300">{formatMoney(row.expectancy)}</td>
                  <td className="py-2.5 text-zinc-400">
                    {row.avg_r != null ? `${row.avg_r.toFixed(2)}R` : "—"}
                  </td>
                  <td
                    className={`py-2.5 text-right font-mono ${
                      row.pnl >= 0 ? "text-positive" : "text-negative"
                    }`}
                  >
                    {formatMoney(row.pnl)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
}) {
  return (
    <Card>
      <p className="text-xs text-gray-400">{label}</p>
      <p
        className={`mt-1 text-xl font-semibold ${
          tone === "pos" ? "text-positive" : tone === "neg" ? "text-negative" : "text-white"
        }`}
      >
        {value}
      </p>
    </Card>
  );
}
