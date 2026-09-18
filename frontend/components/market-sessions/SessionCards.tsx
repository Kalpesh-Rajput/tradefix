"use client";

import clsx from "clsx";

import { SessionInfoPopover } from "@/components/market-sessions/SessionInfoPopover";
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {snapshot.rows.map((row) => {
        const live = snapshot.isToday;
        const overlapping = live && snapshot.currentOverlaps.some((o) => o.ids.includes(row.def.id));
        const open = live && row.isOpen;
        return (
          <SessionInfoPopover
            key={row.def.id}
            row={row}
            viewTimeZone={snapshot.viewTimeZone}
            hourCycle={hourCycle}
            className={clsx(
              "dash-card flex h-full min-h-[148px] w-full flex-col p-4 transition-colors",
              "hover:bg-[var(--color-primary-very-light)]"
            )}
          >
            <span className="flex h-full min-h-[148px] w-full flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: row.def.color, opacity: open ? 1 : 0.4 }}
                    aria-hidden
                  />
                  <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">{row.def.name}</span>
                </div>
                <span
                  className={clsx(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    open
                      ? "bg-[var(--color-primary-very-light)] text-[var(--color-text-primary)]"
                      : "bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)]"
                  )}
                >
                  {!live ? "Scheduled" : row.isOpen ? "Open" : "Closed"}
                </span>
              </div>
              <p className="mt-3 text-[18px] font-semibold tabular-nums tracking-tight text-[var(--color-text-primary)]">
                {formatTimeInZone(row.open, snapshot.viewTimeZone, hourCycle)}
                <span className="mx-1 text-[var(--color-text-muted)]">—</span>
                {formatTimeInZone(row.close, snapshot.viewTimeZone, hourCycle)}
              </p>
              <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">
                {formatSessionHours(row.durationMinutes)} session
              </p>
              <p className="mt-auto pt-3 text-[12px] text-[var(--color-text-tertiary)]">
                {live && row.isOpen && row.closesInMs != null
                  ? `Closes in ${formatDurationMs(row.closesInMs)}`
                  : live && row.opensInMs != null
                    ? `Opens in ${formatDurationMs(row.opensInMs)}`
                    : "Hours in selected timezone"}
              </p>
              {overlapping ? (
                <p className="mt-1 text-[11px] font-medium text-[var(--color-text-secondary)]">Overlap active</p>
              ) : null}
            </span>
          </SessionInfoPopover>
        );
      })}
    </div>
  );
}
