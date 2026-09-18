"use client";

import clsx from "clsx";

import { SessionInfoPopover } from "@/components/market-sessions/SessionInfoPopover";
import { formatTimeInZone, timeOfDayProgress } from "@/lib/market-sessions/timezone";
import type { HourCycle, MarketSessionSnapshot, SessionRowView } from "@/lib/market-sessions/types";

const HOURS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24];

function hourLabel(hour: number, hourCycle: HourCycle): string {
  if (hourCycle === "h24" || hour === 24) return String(hour).padStart(2, "0");
  if (hour === 0) return "12a";
  if (hour === 12) return "12p";
  return hour > 12 ? `${hour - 12}p` : `${hour}a`;
}

function SessionBar({
  row,
  viewTimeZone,
  hourCycle,
  isToday,
}: {
  row: SessionRowView;
  viewTimeZone: string;
  hourCycle: HourCycle;
  isToday: boolean;
}) {
  const active = isToday && row.isOpen;
  return (
    <SessionInfoPopover
      row={row}
      viewTimeZone={viewTimeZone}
      hourCycle={hourCycle}
      className="relative block h-11 w-full rounded-sm"
    >
      <span className="relative block h-11 w-full">
        {row.segments.map((seg) => (
          <span
            key={`${seg.startPct}-${seg.endPct}`}
            className="absolute top-3.5 h-4 rounded-[4px] transition-opacity"
            style={{
              left: `${seg.startPct}%`,
              width: `${Math.max(seg.endPct - seg.startPct, 0.8)}%`,
              background: row.def.color,
              opacity: active ? 0.92 : 0.4,
            }}
          />
        ))}
        <span className="sr-only">
          {row.def.name}, {isToday ? (row.isOpen ? "open" : "closed") : "scheduled"},{" "}
          {formatTimeInZone(row.open, viewTimeZone, hourCycle)} to{" "}
          {formatTimeInZone(row.close, viewTimeZone, hourCycle)}
        </span>
      </span>
    </SessionInfoPopover>
  );
}

export function SessionTimeline({
  snapshot,
  now,
  hourCycle,
}: {
  snapshot: MarketSessionSnapshot;
  now: Date;
  hourCycle: HourCycle;
}) {
  const progress = snapshot.isToday ? timeOfDayProgress(now, snapshot.viewTimeZone) : null;
  const markerLeft = progress != null ? `${Math.min(100, Math.max(0, progress * 100))}%` : null;
  const markerTime = formatTimeInZone(now, snapshot.viewTimeZone, hourCycle);

  return (
    <section className="dash-card overflow-hidden p-4">
      <div className="mb-3 flex h-11 items-center justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Session timeline</h2>
          <p className="text-[11px] text-[var(--color-text-tertiary)]">
            Bars show each session in the selected timezone
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[720px] grid-cols-[88px_minmax(0,1fr)]">
          <div>
            <div className="h-5" />
            {snapshot.rows.map((row) => (
              <div key={row.def.id} className="flex h-11 flex-col justify-center pr-3">
                <p className="truncate text-[12px] font-medium text-[var(--color-text-primary)]">{row.def.name}</p>
                <p
                  className={clsx(
                    "text-[10px] font-semibold uppercase tracking-wide",
                    snapshot.isToday && row.isOpen
                      ? "text-[var(--color-text-primary)]"
                      : "text-[var(--color-text-muted)]"
                  )}
                >
                  {snapshot.isToday ? (row.isOpen ? "Open" : "Closed") : "Scheduled"}
                </p>
              </div>
            ))}
          </div>

          <div className="relative min-w-0">
            <div className="relative mb-0 h-5">
              {HOURS.map((hour) => {
                const pct = (hour / 24) * 100;
                return (
                  <span
                    key={hour}
                    className="absolute top-0 text-[10px] tabular-nums text-[var(--color-text-muted)]"
                    style={{
                      left: `${pct}%`,
                      transform: hour === 0 ? "none" : hour === 24 ? "translateX(-100%)" : "translateX(-50%)",
                    }}
                  >
                    {hourLabel(hour, hourCycle)}
                  </span>
                );
              })}
            </div>

            {snapshot.rows.map((row) => (
              <div key={row.def.id} className="relative border-t border-[var(--color-border)]">
                <div
                  className="pointer-events-none absolute inset-0 opacity-60"
                  aria-hidden
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(to right, var(--color-border) 0, var(--color-border) 1px, transparent 1px, transparent calc(100% / 12))",
                  }}
                />
                <SessionBar
                  row={row}
                  viewTimeZone={snapshot.viewTimeZone}
                  hourCycle={hourCycle}
                  isToday={snapshot.isToday}
                />
              </div>
            ))}

            {markerLeft ? (
              <div
                className="pointer-events-none absolute top-0 z-10 h-full"
                style={{ left: markerLeft }}
                aria-hidden
              >
                <div className="absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  {markerTime}
                </div>
                <div className="absolute left-1/2 top-5 h-[calc(100%-12px)] w-px -translate-x-1/2 bg-primary" />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
