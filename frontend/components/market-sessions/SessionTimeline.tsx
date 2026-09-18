"use client";

import clsx from "clsx";

import { SessionFlag } from "@/components/market-sessions/SessionFlag";
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
      className="relative block h-12 w-full rounded-md"
    >
      <span className="relative block h-12 w-full">
        {row.segments.map((seg) => (
          <span
            key={`${seg.startPct}-${seg.endPct}`}
            className={clsx(
              "absolute top-[14px] h-[20px] rounded-md transition-[filter,transform,box-shadow] duration-150",
              "hover:brightness-110"
            )}
            style={{
              left: `${seg.startPct}%`,
              width: `${Math.max(seg.endPct - seg.startPct, 0.8)}%`,
              background: `linear-gradient(180deg, color-mix(in srgb, ${row.def.color} 88%, white) 0%, ${row.def.color} 100%)`,
              opacity: active ? 1 : 0.42,
              boxShadow: active
                ? `0 0 0 1px color-mix(in srgb, ${row.def.color} 55%, transparent), 0 4px 10px color-mix(in srgb, ${row.def.color} 28%, transparent)`
                : undefined,
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
  const markerLeft = progress != null ? `${Math.min(99.2, Math.max(0.8, progress * 100))}%` : null;
  const markerTime = formatTimeInZone(now, snapshot.viewTimeZone, hourCycle);
  const openNow = snapshot.rows.filter((r) => r.isOpen);

  return (
    <section className="ms-card overflow-hidden p-3.5 sm:p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-[var(--color-text-primary)]">
            Session timeline
          </h2>
          <p className="text-[11px] text-[var(--color-text-tertiary)]">
            Global trading windows in your selected timezone
          </p>
        </div>
        {snapshot.isToday ? (
          <p className="text-[11px] font-medium text-[var(--color-text-secondary)]">
            {openNow.length === 0
              ? "No major session open"
              : `${openNow.length} session${openNow.length === 1 ? "" : "s"} open now`}
          </p>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[760px] grid-cols-[118px_minmax(0,1fr)]">
          <div>
            <div className="h-6" />
            {snapshot.rows.map((row) => (
              <div key={row.def.id} className="flex h-12 items-center gap-2 pr-3">
                <SessionFlag sessionId={row.def.id} title={row.def.name} />
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-[var(--color-text-primary)]">{row.def.name}</p>
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
              </div>
            ))}
          </div>

          <div className="relative min-w-0">
            <div className="relative h-6">
              {HOURS.map((hour) => {
                const pct = (hour / 24) * 100;
                const major = hour === 0 || hour === 12 || hour === 24;
                return (
                  <span
                    key={hour}
                    className={clsx(
                      "absolute top-0 text-[10px] tabular-nums",
                      major ? "font-semibold text-[var(--color-text-secondary)]" : "text-[var(--color-text-muted)]"
                    )}
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
              <div key={row.def.id} className="relative">
                <div className="pointer-events-none absolute inset-0" aria-hidden>
                  {HOURS.map((hour) => {
                    const major = hour === 0 || hour === 12 || hour === 24;
                    return (
                      <span
                        key={hour}
                        className="absolute top-0 h-full w-px"
                        style={{
                          left: `${(hour / 24) * 100}%`,
                          background: major
                            ? "color-mix(in srgb, var(--color-text-muted) 28%, transparent)"
                            : "color-mix(in srgb, var(--color-border) 80%, transparent)",
                        }}
                      />
                    );
                  })}
                </div>
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
                className="pointer-events-none absolute top-0 z-10 h-full transition-[left] duration-1000 ease-linear"
                style={{ left: markerLeft }}
              >
                <div className="absolute left-1/2 top-0 -translate-x-1/2 rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold tabular-nums text-primary-foreground shadow-[var(--shadow-sm)]">
                  {markerTime}
                  <span className="absolute left-1/2 top-full h-1.5 w-1.5 -translate-x-1/2 rotate-45 bg-primary" />
                </div>
                <div className="absolute left-1/2 top-5 h-[calc(100%-14px)] w-px -translate-x-1/2 bg-primary/80" />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {snapshot.isToday ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Markets open now
          </p>
          {openNow.length === 0 ? (
            <p className="text-[12px] text-[var(--color-text-secondary)]">None</p>
          ) : (
            openNow.map((row) => (
              <span
                key={row.def.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-2 py-0.5 text-[12px] font-medium text-[var(--color-text-primary)]"
              >
                <SessionFlag sessionId={row.def.id} size="sm" />
                {row.def.name}
                <span className="ms-live-dot !h-1.5 !w-1.5" />
              </span>
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}
