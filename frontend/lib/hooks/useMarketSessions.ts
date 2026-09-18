"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useLocale } from "@/components/providers/LocaleProvider";
import { buildMarketSessionSnapshot } from "@/lib/market-sessions/calculations";
import {
  readMarketSessionPrefs,
  writeMarketSessionHourCycle,
  writeMarketSessionTimezone,
} from "@/lib/market-sessions/preferences";
import { dateKeyInZone, detectBrowserTimeZone } from "@/lib/market-sessions/timezone";
import type { HourCycle } from "@/lib/market-sessions/types";

export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, intervalMs);
    function onWake() {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      tick();
    }
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, [intervalMs]);

  return now;
}

export function useMarketSessionPrefs() {
  const { timezone: userTimezone } = useLocale();
  const [timezone, setTimezoneState] = useState(() => readMarketSessionPrefs(userTimezone).timezone);
  const [hourCycle, setHourCycleState] = useState<HourCycle>(
    () => readMarketSessionPrefs(userTimezone).hourCycle
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readMarketSessionPrefs(userTimezone);
    setTimezoneState(stored.timezone);
    setHourCycleState(stored.hourCycle);
    setHydrated(true);
  }, [userTimezone]);

  const setTimezone = useCallback((next: string) => {
    setTimezoneState(next);
    writeMarketSessionTimezone(next);
  }, []);

  const setHourCycle = useCallback((next: HourCycle) => {
    setHourCycleState(next);
    writeMarketSessionHourCycle(next);
  }, []);

  const browserTimeZone = useMemo(() => detectBrowserTimeZone(), []);

  return { timezone, hourCycle, setTimezone, setHourCycle, hydrated, browserTimeZone };
}

export function useMarketSessions(viewDate?: string) {
  const now = useNow(1000);
  const prefs = useMarketSessionPrefs();
  const todayKey = dateKeyInZone(now, prefs.timezone);
  const resolvedDate = viewDate ?? todayKey;
  const minuteKey = Math.floor(now.getTime() / 60_000);

  const snapshot = useMemo(
    () =>
      buildMarketSessionSnapshot({
        now: new Date(minuteKey * 60_000),
        viewTimeZone: prefs.timezone,
        viewDate: resolvedDate,
      }),
    [minuteKey, prefs.timezone, resolvedDate]
  );

  return {
    now,
    todayKey,
    viewDate: resolvedDate,
    snapshot,
    prefs,
  };
}
