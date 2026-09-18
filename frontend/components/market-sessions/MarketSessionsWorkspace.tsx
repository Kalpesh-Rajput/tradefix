"use client";

import { useMemo, useState } from "react";

import { HeaderActions } from "@/components/layout/HeaderActions";
import { MarketActivity } from "@/components/market-sessions/MarketActivity";
import { MarketClockPanel } from "@/components/market-sessions/MarketClockPanel";
import { MarketInsights } from "@/components/market-sessions/MarketInsights";
import { LiveIndicator } from "@/components/market-sessions/SessionChrome";
import { CurrencyConverter } from "@/components/market-sessions/CurrencyConverter";
import { SessionCards } from "@/components/market-sessions/SessionCards";
import { SessionStatusPanel } from "@/components/market-sessions/SessionStatusPanel";
import { SessionTimeline } from "@/components/market-sessions/SessionTimeline";
import { useLocale } from "@/components/providers/LocaleProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import { useMarketSessions } from "@/lib/hooks/useMarketSessions";
import { friendlyTimeZoneLabel } from "@/lib/market-sessions/timezone";

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
        <div className="mx-auto w-full max-w-[1480px] space-y-2.5 px-4 pt-3 sm:px-5">
          <Skeleton className="h-28 rounded-[10px]" />
          <Skeleton className="h-40 rounded-[10px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[var(--color-background)]">
      <HeaderActions subtitle={t("marketSessions.subtitle")}>
        <span className="flex items-center gap-2">
          <LiveIndicator />
          <span className="hidden max-w-[240px] truncate text-[11px] text-[var(--color-text-tertiary)] lg:inline">
            {friendlyTimeZoneLabel(prefs.timezone, now, prefs.timezone === prefs.browserTimeZone)}
          </span>
        </span>
      </HeaderActions>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-2.5 px-4 py-3 sm:px-5">
          <MarketClockPanel
            now={now}
            timezone={prefs.timezone}
            hourCycle={prefs.hourCycle}
            locale={locale}
            dateMode={dateMode}
            viewDate={snapshot.viewDate}
            localTimeZone={prefs.browserTimeZone}
            onTimezone={prefs.setTimezone}
            onHourCycle={prefs.setHourCycle}
            onDateMode={(id) => {
              if (id === "today") setViewDate(undefined);
              else if (id === "tomorrow") setViewDate(tomorrowKey);
              else document.getElementById("market-session-date")?.focus();
            }}
            onCustomDate={setViewDate}
          />
          <SessionStatusPanel snapshot={snapshot} now={now} hourCycle={prefs.hourCycle} />
          <SessionTimeline snapshot={snapshot} now={now} hourCycle={prefs.hourCycle} />
          <div className="grid grid-cols-1 items-stretch gap-2.5 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)]">
            <MarketActivity snapshot={snapshot} />
            <MarketInsights snapshot={snapshot} now={now} />
          </div>
          <SessionCards snapshot={snapshot} hourCycle={prefs.hourCycle} />
          <p className="px-0.5 text-[11px] text-[var(--color-text-muted)]">
            Session windows use each market’s local cash hours and convert live, including daylight saving. Forex spot
            typically pauses from Friday close to Sunday open.
          </p>
          <CurrencyConverter timezone={prefs.timezone} hourCycle={prefs.hourCycle} />
        </div>
      </div>
    </div>
  );
}
