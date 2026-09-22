"use client";

import Link from "next/link";

import { ChartCard } from "@/components/dashboard/zella/ChartCard";
import { SessionFlag } from "@/components/market-sessions/SessionFlag";
import { useMarketSessions } from "@/lib/hooks/useMarketSessions";
import { formatDurationMs } from "@/lib/market-sessions/timezone";

export function MarketSessionsWidget() {
  const { snapshot, prefs } = useMarketSessions();

  if (!prefs.hydrated) {
    return (
      <ChartCard title="Market sessions">
        <div className="flex min-h-[120px] flex-1 flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded-md bg-[var(--color-surface-secondary)]" />
          ))}
        </div>
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
        <Link
          href="/market-sessions"
          className="shrink-0 text-[11px] font-medium text-primary hover:underline"
        >
          View sessions
        </Link>
      }
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ul className="flex min-h-0 flex-1 flex-col justify-center gap-2">
          {snapshot.rows.map((row) => (
            <li key={row.def.id} className="min-w-0">
              <p className="flex items-center gap-2 text-[13px] font-medium leading-5 text-[var(--color-text-primary)]">
                <SessionFlag sessionId={row.def.id} size="sm" />
                <span className="truncate">{row.def.name}</span>
              </p>
              <p
                className={
                  row.isOpen
                    ? "pl-[26px] text-[12px] font-medium text-primary"
                    : "pl-[26px] text-[12px] text-[var(--color-text-secondary)]"
                }
              >
                {row.isOpen ? "Open" : "Closed"}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] leading-snug text-[var(--color-text-tertiary)]">
          Next: {nextLabel}
        </p>
      </div>
    </ChartCard>
  );
}
