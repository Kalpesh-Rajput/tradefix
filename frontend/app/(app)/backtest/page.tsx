"use client";

import Link from "next/link";

import { BacktestHubTabs } from "@/components/backtest/BacktestHubTabs";
import { useAuth } from "@/components/providers/AuthProvider";

export default function BacktestPage() {
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Practice desk</p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">Backtesting</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Trade stored candles by hand, or run a strategy over a date range. EUR/USD and EUR/CHF are ready from January through early October 2026.
          </p>
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
