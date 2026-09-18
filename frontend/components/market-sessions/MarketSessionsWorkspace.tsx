"use client";

import { useMemo, useState } from "react";

import { HeaderActions } from "@/components/layout/HeaderActions";
import { MarketActivity } from "@/components/market-sessions/MarketActivity";
import { SessionCards } from "@/components/market-sessions/SessionCards";
import { SessionStatusPanel } from "@/components/market-sessions/SessionStatusPanel";
import { SessionTimeline } from "@/components/market-sessions/SessionTimeline";
import { TimezonePicker } from "@/components/market-sessions/TimezonePicker";
import { useLocale } from "@/components/providers/LocaleProvider";
import { ReportSegmentedControl } from "@/components/reports/ReportSegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { useMarketSessions } from "@/lib/hooks/useMarketSessions";
import { formatDateLongInZone, formatTimeInZone, friendlyTimeZoneLabel } from "@/lib/market-sessions/timezone";
import type { HourCycle } from "@/lib/market-sessions/types";

export function MarketSessionsWorkspace() {
  const { t, locale } = useLocale();
  const [viewDate, setViewDate] = useState<string | undefined>(undefined);
  const { now, todayKey, snapshot, prefs } = useMarketSessions(viewDate);
  const tomorrowKey = useMemo(() => {
    const [y, m, d] = todayKey.split("-").map(Number);
    const utc = new Date(Date.UTC(y, m - 1, d + 1));
    return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, "0")}-${String(utc.getUTCDate()).padStart(2, "0")}`;
  }, [todayKey]);

  const dateMode = snapshot.viewDate === todayKey ? "today" : snapshot.viewDate === tomorrowKey ? "tomorrow" : "custom";

  if (!prefs.hydrated) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[var(--color-background)]">
        <div className="space-y-3 px-4 pt-3 sm:px-5">
          <Skeleton className="h-28 rounded-[10px]" />
          <Skeleton className="h-40 rounded-[10px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[var(--color-background)]">
      <HeaderActions subtitle={t("marketSessions.subtitle")}>
        <span className="hidden max-w-[220px] truncate text-[11px] text-[var(--color-text-tertiary)] sm:inline">
          {friendlyTimeZoneLabel(prefs.timezone, now, prefs.timezone === prefs.browserTimeZone)}
        </span>
      </HeaderActions>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pt-3 pb-4 sm:px-5">
        <section className="dash-card p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                Current time
              </p>
              <p className="mt-1 text-[32px] font-semibold leading-none tracking-tight tabular-nums text-[var(--color-text-primary)]">
                {formatTimeInZone(now, prefs.timezone, prefs.hourCycle)}
              </p>
              <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">
                {formatDateLongInZone(now, prefs.timezone, locale)}
              </p>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <TimezonePicker
                value={prefs.timezone}
                onChange={prefs.setTimezone}
                at={now}
                localTimeZone={prefs.browserTimeZone}
              />
              <ReportSegmentedControl<HourCycle>
                value={prefs.hourCycle}
                onChange={prefs.setHourCycle}
                ariaLabel="Time format"
                options={[
                  { id: "h12", label: "12 hour" },
                  { id: "h24", label: "24 hour" },
                ]}
              />
              <ReportSegmentedControl<"today" | "tomorrow" | "custom">
                value={dateMode}
                onChange={(id) => {
                  if (id === "today") setViewDate(undefined);
                  else if (id === "tomorrow") setViewDate(tomorrowKey);
                  else document.getElementById("market-session-date")?.focus();
                }}
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
              <input
                id="market-session-date"
                type="date"
                value={snapshot.viewDate}
                onChange={(e) => {
                  const next = e.target.value;
                  if (!next) return;
                  setViewDate(next);
                }}
                className="h-8 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[12px] font-medium text-[var(--color-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              />
            </div>
          </div>
        </section>

        <SessionStatusPanel snapshot={snapshot} now={now} />
        <SessionTimeline snapshot={snapshot} now={now} hourCycle={prefs.hourCycle} />
        <MarketActivity values={snapshot.activity} />
        <SessionCards snapshot={snapshot} hourCycle={prefs.hourCycle} />
        <p className="px-1 text-[11px] text-[var(--color-text-muted)]">
          Session windows use each market’s local cash hours and convert live, including daylight saving. Forex spot
          typically pauses from Friday close to Sunday open.
        </p>
      </div>
    </div>
  );
}
