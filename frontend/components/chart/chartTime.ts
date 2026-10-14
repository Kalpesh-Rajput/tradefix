export const UTC_ZONE = "UTC";

const TICK_YEAR = 0;
const TICK_MONTH = 1;
const TICK_DAY = 2;
const TICK_TIME_WITH_SECONDS = 4;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string, key: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const cacheKey = `${timeZone}|${key}`;
  let cached = formatters.get(cacheKey);
  if (!cached) {
    cached = new Intl.DateTimeFormat(undefined, { timeZone, hourCycle: "h23", ...options });
    formatters.set(cacheKey, cached);
  }
  return cached;
}

export function safeTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return UTC_ZONE;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone });
    return timeZone;
  } catch {
    return UTC_ZONE;
  }
}

export function formatCrosshairTime(ms: number, timeZone: string): string {
  return formatter(timeZone, "crosshair", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(ms);
}

export function formatTickMark(ms: number, tickType: number, timeZone: string): string {
  if (tickType === TICK_YEAR) return formatter(timeZone, "year", { year: "numeric" }).format(ms);
  if (tickType === TICK_MONTH) return formatter(timeZone, "month", { month: "short" }).format(ms);
  if (tickType === TICK_DAY) return formatter(timeZone, "day", { day: "numeric", month: "short" }).format(ms);
  if (tickType === TICK_TIME_WITH_SECONDS) {
    return formatter(timeZone, "seconds", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(ms);
  }
  return formatter(timeZone, "time", { hour: "2-digit", minute: "2-digit" }).format(ms);
}

export function timeZoneLabel(timeZone: string, at = Date.now()): string {
  if (timeZone === UTC_ZONE) return UTC_ZONE;
  const part = formatter(timeZone, "zone", { timeZoneName: "short" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? timeZone;
}
