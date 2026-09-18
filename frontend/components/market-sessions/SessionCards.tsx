"use client";

import clsx from "clsx";

import { SessionFlag } from "@/components/market-sessions/SessionFlag";
import { SessionProgress, SessionStatusBadge } from "@/components/market-sessions/SessionChrome";
import { SessionInfoPopover } from "@/components/market-sessions/SessionInfoPopover";
import { sessionElapsedPct } from "@/components/market-sessions/sessionUi";
import { formatDurationMs, formatSessionHours, formatTimeInZone } from "@/lib/market-sessions/timezone";
import type { HourCycle, MarketSessionSnapshot } from "@/lib/market-sessions/types";

export function SessionCards({
  snapshot,
  hourCycle,
}: {
  snapshot: MarketSessionSnapshot;
  hourCycle: HourCycle;
}) {
  return (
    <section>
      <div className="mb-2.5">
        <h2 className="text-[15px] font-semibold tracking-tight text-[var(--color-text-primary)]">Session markets</h2>
        <p className="text-[11px] text-[var(--color-text-tertiary)]">Hours converted to your selected timezone</p>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {snapshot.rows.map((row) => {
          const live = snapshot.isToday;
          const overlapping = live && snapshot.currentOverlaps.some((o) => o.ids.includes(row.def.id));
          const open = live && row.isOpen;
          const elapsed = live ? sessionElapsedPct(row) : null;
          return (
            <SessionInfoPopover
              key={row.def.id}
              row={row}
              viewTimeZone={snapshot.viewTimeZone}
              hourCycle={hourCycle}
              className={clsx(
                "ms-card ms-card-hover flex h-full min-h-[176px] w-full flex-col p-3.5",
                open && "border-[color-mix(in_srgb,var(--color-primary)_32%,var(--color-border))]"
              )}
            >
              <span
                className="mb-3 h-0.5 w-8 rounded-full"
                style={{ background: row.def.color, opacity: open ? 1 : 0.45 }}
                aria-hidden
              />
              <span className="flex h-full min-h-[148px] w-full flex-col">
                <span className="flex items-start justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <SessionFlag sessionId={row.def.id} title={row.def.name} />
                    <span className="truncate text-[16px] font-semibold tracking-tight text-[var(--color-text-primary)]">
                      {row.def.name}
                    </span>
                  </span>
                  <SessionStatusBadge open={open} scheduled={!live} />
                </span>
                <p className="mt-3 text-[17px] font-semibold tabular-nums tracking-tight text-[var(--color-text-primary)]">
                  {formatTimeInZone(row.open, snapshot.viewTimeZone, hourCycle)}
                  <span className="mx-1 font-medium text-[var(--color-text-muted)]">—</span>
                  {formatTimeInZone(row.close, snapshot.viewTimeZone, hourCycle)}
                </p>
                <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">
                  {formatSessionHours(row.durationMinutes)} session
                </p>
                {elapsed != null ? (
                  <span className="mt-auto block pt-3">
                    <SessionProgress value={elapsed} color={row.def.color} label="Session progress" />
                  </span>
                ) : (
                  <p className="mt-auto pt-3 text-[12px] text-[var(--color-text-tertiary)]">
                    {live && row.opensInMs != null
                      ? `Opens in ${formatDurationMs(row.opensInMs)}`
                      : live
                        ? "Closed for this window"
                        : "Hours in selected timezone"}
                  </p>
                )}
                {elapsed != null ? (
                  <p className="mt-2 text-[12px] text-[var(--color-text-tertiary)]">
                    Closes in {formatDurationMs(row.closesInMs ?? 0)}
                  </p>
                ) : null}
                {overlapping ? (
                  <p className="mt-1 text-[11px] font-medium text-[var(--color-text-secondary)]">Overlap active</p>
                ) : null}
              </span>
            </SessionInfoPopover>
          );
        })}
      </div>
    </section>
  );
}
