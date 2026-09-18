"use client";

import clsx from "clsx";
import Link from "next/link";

import { ChartCard } from "@/components/dashboard/zella/ChartCard";
import { useMarketSessions } from "@/lib/hooks/useMarketSessions";
import { formatDurationMs } from "@/lib/market-sessions/timezone";

export function MarketSessionsWidget() {
  const { snapshot, prefs } = useMarketSessions();

  if (!prefs.hydrated) {
    return (
      <ChartCard title="Market sessions">
        <div className="h-[88px] animate-pulse rounded-md bg-[var(--color-surface-secondary)]" />
      </ChartCard>
    );
  }

  const nextLabel = snapshot.nextClose
    ? `${snapshot.nextClose.name} closes in ${formatDurationMs(snapshot.nextClose.inMs)}`
    : snapshot.nextOpen
      ? `${snapshot.nextOpen.name} opens in ${formatDurationMs(snapshot.nextOpen.inMs)}`
      : "No upcoming change";

  return (
    <ChartCard
      title="Market sessions"
      hint="Live open/closed state for the major FX cash sessions in your selected timezone."
      headerRight={
        <Link href="/market-sessions" className="text-[11px] font-medium text-primary hover:underline">
          View sessions
        </Link>
      }
    >
      <ul className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
        {snapshot.rows.map((row) => (
          <li key={row.def.id} className="min-w-0">
            <p className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-text-primary)]">
              <span
                className={clsx("h-1.5 w-1.5 rounded-full", row.isOpen ? "opacity-100" : "opacity-40")}
                style={{ background: row.def.color }}
                aria-hidden
              />
              {row.def.name}
            </p>
            <p className="pl-3 text-[11px] text-[var(--color-text-secondary)]">{row.isOpen ? "Open" : "Closed"}</p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] text-[var(--color-text-tertiary)]">
        Next: {nextLabel}
      </p>
    </ChartCard>
  );
}
