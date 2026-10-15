"use client";

import { BacktestHubTabs } from "@/components/backtest/BacktestHubTabs";

export default function BacktestPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Backtesting</h1>
        <p className="mt-1 text-sm text-muted">Replay a session by hand, or review setups from your live journal.</p>
      </div>
      <BacktestHubTabs />
    </div>
  );
}
