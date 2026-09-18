import type { HourCycle } from "@/lib/market-sessions/types";
import { detectBrowserTimeZone, isValidTimeZone } from "@/lib/market-sessions/timezone";

const TZ_KEY = "tradefix.marketSessions.timezone";
const FORMAT_KEY = "tradefix.marketSessions.timeFormat";

export type MarketSessionPrefs = {
  timezone: string;
  hourCycle: HourCycle;
};

function readHourCycle(raw: string | null): HourCycle {
  return raw === "h24" || raw === "24" ? "h24" : "h12";
}

export function readMarketSessionPrefs(fallbackTimeZone?: string | null): MarketSessionPrefs {
  let timezone = detectBrowserTimeZone();
  if (!isValidTimeZone(timezone) && fallbackTimeZone && isValidTimeZone(fallbackTimeZone)) {
    timezone = fallbackTimeZone;
  }
  let hourCycle: HourCycle = "h12";
  if (typeof window === "undefined") return { timezone, hourCycle };
  try {
    const storedTz = window.localStorage.getItem(TZ_KEY);
    if (storedTz && isValidTimeZone(storedTz)) timezone = storedTz;
    hourCycle = readHourCycle(window.localStorage.getItem(FORMAT_KEY));
  } catch {
    /* ignore quota / private mode */
  }
  return { timezone, hourCycle };
}

export function writeMarketSessionTimezone(timezone: string): void {
  if (typeof window === "undefined" || !isValidTimeZone(timezone)) return;
  try {
    window.localStorage.setItem(TZ_KEY, timezone);
  } catch {
    /* ignore */
  }
}

export function writeMarketSessionHourCycle(hourCycle: HourCycle): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FORMAT_KEY, hourCycle);
  } catch {
    /* ignore */
  }
}
