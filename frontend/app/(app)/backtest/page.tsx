"use client";

import Link from "next/link";

import { BacktestHubTabs } from "@/components/backtest/BacktestHubTabs";
import { useAuth } from "@/components/providers/AuthProvider";

export default function BacktestPage() {
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Backtesting</h1>
          <p className="mt-1 text-sm text-muted">Replay a session by hand, or review setups from your live journal.</p>
        </div>
        {user?.role === "admin" ? (
          <Link href="/admin/data-status" className="text-sm text-primary hover:underline">
            Market data
          </Link>
        ) : null}
      </div>
      <BacktestHubTabs />
    </div>
  );
}
