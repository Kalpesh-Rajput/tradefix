"use client";

import { formatDurationMs } from "@/lib/market-sessions/timezone";
import type { MarketSessionSnapshot } from "@/lib/market-sessions/types";

export function SessionStatusPanel({ snapshot, now }: { snapshot: MarketSessionSnapshot; now: Date }) {
  const activeNames = snapshot.rows.filter((r) => r.isOpen).map((r) => r.def.name);
  const currentOverlap = snapshot.currentOverlaps[0] ?? null;

  return (
    <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-3">
      <section className="dash-card flex min-h-[148px] flex-col p-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {activeNames.length > 1 ? "Active sessions" : activeNames.length === 1 ? "Current session" : "Active sessions"}
        </h2>
        {activeNames.length === 0 ? (
          <p className="mt-3 text-[15px] font-semibold text-[var(--color-text-primary)]">None open right now</p>
        ) : (
          <ul className="mt-3 space-y-1">
            {activeNames.map((name) => (
              <li key={name} className="text-[18px] font-semibold tracking-tight text-[var(--color-text-primary)]">
                {name}
              </li>
            ))}
          </ul>
        )}
        {snapshot.nextClose ? (
          <p className="mt-auto pt-3 text-[12px] text-[var(--color-text-secondary)]">
            {snapshot.nextClose.name} closes in {formatDurationMs(snapshot.nextClose.inMs)}
          </p>
        ) : snapshot.nextOpen ? (
          <p className="mt-auto pt-3 text-[12px] text-[var(--color-text-secondary)]">
            Next: {snapshot.nextOpen.name} opens in {formatDurationMs(snapshot.nextOpen.inMs)}
          </p>
        ) : null}
      </section>

      <section className="dash-card flex min-h-[148px] flex-col p-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Next session
        </h2>
        {snapshot.nextOpen ? (
          <>
            <p className="mt-3 text-[18px] font-semibold tracking-tight text-[var(--color-text-primary)]">
              {snapshot.nextOpen.name}
            </p>
            <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
              Opens in {formatDurationMs(snapshot.nextOpen.inMs)}
            </p>
          </>
        ) : (
          <p className="mt-3 text-[15px] font-semibold text-[var(--color-text-primary)]">All sessions are open</p>
        )}
      </section>

      <section className="dash-card flex min-h-[148px] flex-col p-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {currentOverlap ? "Current overlap" : "Next overlap"}
        </h2>
        {currentOverlap ? (
          <>
            <p className="mt-3 text-[18px] font-semibold tracking-tight text-[var(--color-text-primary)]">
              {currentOverlap.names}
            </p>
            <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">Sessions currently overlapping</p>
          </>
        ) : snapshot.nextOverlap ? (
          <>
            <p className="mt-3 text-[18px] font-semibold tracking-tight text-[var(--color-text-primary)]">
              {snapshot.nextOverlap.names}
            </p>
            <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
              Starts in {formatDurationMs(snapshot.nextOverlap.start.getTime() - now.getTime())}
            </p>
          </>
        ) : (
          <p className="mt-3 text-[15px] font-semibold text-[var(--color-text-primary)]">No overlap upcoming</p>
        )}
      </section>
    </div>
  );
}
