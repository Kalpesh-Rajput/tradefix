"use client";

import { CalendarDays, Clock, Globe } from "lucide-react";

import { LiveIndicator } from "@/components/market-sessions/SessionChrome";
import { TimezonePicker } from "@/components/market-sessions/TimezonePicker";
import { ReportSegmentedControl } from "@/components/reports/ReportSegmentedControl";
import { formatDateLongInZone, formatGmtOffset, formatTimeInZone } from "@/lib/market-sessions/timezone";
import type { HourCycle } from "@/lib/market-sessions/types";
import { getTimezoneOffsetMinutes } from "@/lib/timezones";

export function MarketClockPanel({
  now,
  timezone,
  hourCycle,
  locale,
  dateMode,
  viewDate,
  localTimeZone,
  onTimezone,
  onHourCycle,
  onDateMode,
  onCustomDate,
}: {
  now: Date;
  timezone: string;
  hourCycle: HourCycle;
  locale: string;
  dateMode: "today" | "tomorrow" | "custom";
  viewDate: string;
  localTimeZone?: string;
  onTimezone: (value: string) => void;
  onHourCycle: (value: HourCycle) => void;
  onDateMode: (value: "today" | "tomorrow" | "custom") => void;
  onCustomDate: (value: string) => void;
}) {
  const offset = formatGmtOffset(getTimezoneOffsetMinutes(timezone, now));

  return (
    <section className="ms-card p-3.5 sm:p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            <Clock className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            Current time
          </p>
          <p className="mt-1.5 text-[36px] font-semibold leading-none tracking-tight tabular-nums text-[var(--color-text-primary)] sm:text-[40px]">
            {formatTimeInZone(now, timezone, hourCycle)}
          </p>
          <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">
            {formatDateLongInZone(now, timezone, locale)}
          </p>
          <LiveIndicator label="Market clock is live" className="mt-2.5" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2.5 xl:max-w-[720px] xl:items-end">
          <div className="flex w-full min-w-0 items-center gap-2 xl:max-w-[360px]">
            <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] sm:inline-flex">
              <Globe className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            </span>
            <TimezonePicker
              value={timezone}
              onChange={onTimezone}
              at={now}
              localTimeZone={localTimeZone}
              className="min-w-0 flex-1"
            />
          </div>
          <p className="hidden text-[11px] text-[var(--color-text-muted)] xl:block">{offset}</p>
          <div className="flex w-full flex-wrap items-center gap-2 xl:justify-end">
            <ReportSegmentedControl<HourCycle>
              value={hourCycle}
              onChange={onHourCycle}
              ariaLabel="Time format"
              options={[
                { id: "h12", label: "12 hour" },
                { id: "h24", label: "24 hour" },
              ]}
            />
            <ReportSegmentedControl<"today" | "tomorrow" | "custom">
              value={dateMode}
              onChange={onDateMode}
              ariaLabel="Schedule day"
              options={[
                { id: "today", label: "Today" },
                { id: "tomorrow", label: "Tomorrow" },
                { id: "custom", label: "Custom" },
              ]}
            />
            <label className="sr-only" htmlFor="market-session-date">
              Custom date
            </label>
            <span className="relative inline-flex h-8 items-center">
              <CalendarDays
                className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-[var(--color-text-muted)]"
                strokeWidth={1.75}
                aria-hidden
              />
              <input
                id="market-session-date"
                type="date"
                value={viewDate}
                onChange={(e) => {
                  const next = e.target.value;
                  if (!next) return;
                  onCustomDate(next);
                }}
                className="h-8 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] pl-7 pr-2 text-[12px] font-medium text-[var(--color-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
