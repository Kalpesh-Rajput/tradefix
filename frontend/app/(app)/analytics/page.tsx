"use client";

import { MoodPnlChart } from "@/components/charts/MoodPnlChart";
import { SetupTable } from "@/components/charts/SetupTable";
import { TimeBucketChart } from "@/components/charts/TimeBucketChart";
import { Card, CardHeader } from "@/components/ui/Card";
import { useAnalytics } from "@/lib/hooks/useAnalytics";

function fmtMoney(n: number) {
  const sign = n >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export default function AnalyticsPage() {
  const { data, isLoading } = useAnalytics();

  if (isLoading || !data) {
    return <p className="text-sm text-gray-500">Loading analytics…</p>;
  }

  const { overview, by_hour, by_day_of_week, by_setup, mood_vs_pnl } = data;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Analytics</h1>
        <p className="mt-1 text-sm text-gray-400">Your worst trades all have one thing in common — we'll find it.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <p className="text-xs text-gray-400">Total trades</p>
          <p className="mt-1 text-xl font-semibold text-white">{overview.total_trades}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-400">Win rate</p>
          <p className="mt-1 text-xl font-semibold text-white">{overview.win_rate}%</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-400">Total P&amp;L</p>
          <p className={`mt-1 text-xl font-semibold ${overview.total_pnl >= 0 ? "text-positive" : "text-negative"}`}>
            {fmtMoney(overview.total_pnl)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-gray-400">Avg win / loss</p>
          <p className="mt-1 text-xl font-semibold text-white">
            <span className="text-positive">{fmtMoney(overview.avg_win)}</span>{" "}
            <span className="text-negative">{fmtMoney(overview.avg_loss)}</span>
          </p>
        </Card>
      </div>

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
        <CardHeader title="Mood vs P&L" subtitle="What mental state actually pays" />
        <MoodPnlChart data={mood_vs_pnl} />
      </Card>
    </div>
  );
}
