"use client";

import { ArrowRight, GitMerge } from "lucide-react";

import { SessionFlag } from "@/components/market-sessions/SessionFlag";
import { SessionProgress, SessionStatusBadge } from "@/components/market-sessions/SessionChrome";
import { openRows, rowById, sessionElapsedPct } from "@/components/market-sessions/sessionUi";
import { formatDurationMs, formatTimeInZone } from "@/lib/market-sessions/timezone";
import type { HourCycle, MarketSessionSnapshot, SessionRowView } from "@/lib/market-sessions/types";

function hoursLabel(row: SessionRowView, timeZone: string, hourCycle: HourCycle) {
  return `${formatTimeInZone(row.open, timeZone, hourCycle)} — ${formatTimeInZone(row.close, timeZone, hourCycle)}`;
}

function OverlapMini({
  left,
  right,
}: {
  left: SessionRowView | null;
  right: SessionRowView | null;
}) {
  if (!left || !right) return null;
  const rows = [left, right];
  return (
    <div className="mt-3 space-y-1.5" aria-hidden>
      {rows.map((row) => (
        <div key={row.def.id} className="flex items-center gap-2">
          <SessionFlag sessionId={row.def.id} size="sm" />
          <div className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--color-gauge-track)]">
            {row.segments.map((seg) => (
              <span
                key={`${seg.startPct}-${seg.endPct}`}
                className="absolute inset-y-0 rounded-full opacity-80"
                style={{
                  left: `${seg.startPct}%`,
                  width: `${Math.max(seg.endPct - seg.startPct, 1)}%`,
                  background: row.def.color,
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SessionStatusPanel({
  snapshot,
  now,
  hourCycle,
}: {
  snapshot: MarketSessionSnapshot;
  now: Date;
  hourCycle: HourCycle;
}) {
  const live = snapshot.isToday;
  const active = openRows(snapshot);
  const primary =
    (snapshot.nextClose ? rowById(snapshot, snapshot.nextClose.id) : null) ?? active[0] ?? null;
  const nextRow = snapshot.nextOpen ? rowById(snapshot, snapshot.nextOpen.id) : null;
  const overlap = snapshot.currentOverlaps[0] ?? snapshot.nextOverlap;
  const overlapActive = Boolean(snapshot.currentOverlaps[0]);
  const overlapLeft = overlap ? rowById(snapshot, overlap.ids[0]) : null;
  const overlapRight = overlap ? rowById(snapshot, overlap.ids[1]) : null;
  const elapsed = primary ? sessionElapsedPct(primary) : null;

  return (
    <div className="grid grid-cols-1 items-stretch gap-2.5 lg:grid-cols-3">
      <section className="ms-card flex h-full min-h-[196px] flex-col p-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {active.length > 1 ? "Active sessions" : "Current session"}
        </p>
        {!live ? (
          <p className="mt-4 text-[15px] font-semibold text-[var(--color-text-primary)]">
            Showing schedule for this date
          </p>
        ) : primary ? (
          <>
            <div className="mt-3 flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <SessionFlag sessionId={primary.def.id} title={primary.def.name} />
                <div className="min-w-0">
                  <p className="truncate text-[18px] font-semibold tracking-tight text-[var(--color-text-primary)]">
                    {primary.def.name}
                  </p>
                  {active.length > 1 ? (
                    <p className="text-[11px] text-[var(--color-text-tertiary)]">
                      {active.map((r) => r.def.name).join(" · ")}
                    </p>
                  ) : null}
                </div>
              </div>
              <SessionStatusBadge open />
            </div>
            <p className="mt-3 text-[13px] tabular-nums text-[var(--color-text-secondary)]">
              {hoursLabel(primary, snapshot.viewTimeZone, hourCycle)}
            </p>
            {primary.closesInMs != null ? (
              <p className="mt-1 text-[12px] text-[var(--color-text-tertiary)]">
                Closes in {formatDurationMs(primary.closesInMs)}
              </p>
            ) : null}
            {elapsed != null ? (
              <div className="mt-auto pt-3">
                <SessionProgress value={elapsed} color={primary.def.color} label="Session progress" />
              </div>
            ) : (
              <div className="mt-auto" />
            )}
          </>
        ) : (
          <>
            <p className="mt-4 text-[15px] font-semibold tracking-tight text-[var(--color-text-primary)]">
              No major session active
            </p>
            {snapshot.nextOpen ? (
              <p className="mt-2 flex items-center gap-2 text-[13px] text-[var(--color-text-secondary)]">
                <SessionFlag sessionId={snapshot.nextOpen.id} size="sm" />
                Next market opens in {formatDurationMs(snapshot.nextOpen.inMs)}
              </p>
            ) : (
              <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">All listed windows are closed.</p>
            )}
          </>
        )}
      </section>

      <section className="ms-card flex h-full min-h-[196px] flex-col p-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Next session
        </p>
        {snapshot.nextOpen ? (
          <>
            <div className="mt-3 flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <SessionFlag sessionId={snapshot.nextOpen.id} title={snapshot.nextOpen.name} />
                <p className="truncate text-[18px] font-semibold tracking-tight text-[var(--color-text-primary)]">
                  {snapshot.nextOpen.name}
                </p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 text-[var(--color-text-muted)]" strokeWidth={1.75} aria-hidden />
            </div>
            {nextRow ? (
              <p className="mt-3 text-[13px] tabular-nums text-[var(--color-text-secondary)]">
                {hoursLabel(nextRow, snapshot.viewTimeZone, hourCycle)}
              </p>
            ) : null}
            <p className="mt-auto pt-3 text-[12px] text-[var(--color-text-tertiary)]">Opens in</p>
            <p className="text-[22px] font-semibold tabular-nums tracking-tight text-[var(--color-text-primary)]">
              {formatDurationMs(snapshot.nextOpen.inMs)}
            </p>
          </>
        ) : (
          <p className="mt-4 text-[15px] font-semibold text-[var(--color-text-primary)]">All sessions are open</p>
        )}
      </section>

      <section className="ms-card flex h-full min-h-[196px] flex-col p-3.5">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          <GitMerge className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          {overlapActive ? "Current overlap" : "Next overlap"}
        </p>
        {overlap ? (
          <>
            <div className="mt-3 flex items-center gap-2">
              <SessionFlag sessionId={overlap.ids[0]} />
              <span className="text-[12px] text-[var(--color-text-muted)]">+</span>
              <SessionFlag sessionId={overlap.ids[1]} />
            </div>
            <p className="mt-2 text-[18px] font-semibold tracking-tight text-[var(--color-text-primary)]">
              {overlap.names}
            </p>
            {overlapActive ? (
              <p className="mt-1 text-[12px] font-medium text-[var(--color-text-secondary)]">Active overlap</p>
            ) : (
              <>
                <p className="mt-1 text-[12px] text-[var(--color-text-tertiary)]">Starts in</p>
                <p className="text-[18px] font-semibold tabular-nums tracking-tight text-[var(--color-text-primary)]">
                  {formatDurationMs(overlap.start.getTime() - now.getTime())}
                </p>
              </>
            )}
            <div className="mt-auto">
              <OverlapMini left={overlapLeft} right={overlapRight} />
            </div>
          </>
        ) : (
          <p className="mt-4 text-[15px] font-semibold text-[var(--color-text-primary)]">No overlap upcoming</p>
        )}
      </section>
    </div>
  );
}
