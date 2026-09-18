import { formatUtcOffset, getTimezoneOffsetMinutes, getTimezoneOptions } from "@/lib/timezones";
import type { HourCycle } from "@/lib/market-sessions/types";

export const FEATURED_TIMEZONES = [
  "UTC",
  "Asia/Kolkata",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Asia/Singapore",
  "Asia/Dubai",
] as const;

const REGION_BY_ZONE: Record<string, string> = {
  UTC: "UTC",
  "Asia/Kolkata": "India",
  "America/New_York": "United States",
  "America/Chicago": "United States",
  "America/Los_Angeles": "United States",
  "Europe/London": "United Kingdom",
  "Europe/Berlin": "Germany",
  "Asia/Tokyo": "Japan",
  "Australia/Sydney": "Australia",
  "Asia/Singapore": "Singapore",
  "Asia/Dubai": "United Arab Emirates",
};

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function detectBrowserTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && isValidTimeZone(tz)) return tz;
  } catch {
    /* fall through */
  }
  return "UTC";
}

export function resolveTimeZone(candidate?: string | null): string {
  if (candidate && isValidTimeZone(candidate)) return candidate;
  return detectBrowserTimeZone();
}

export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const tz = resolveTimeZone(timeZone);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const bag: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  let hour = Number(bag.hour ?? "0");
  if (hour === 24) hour = 0;
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour,
    minute: Number(bag.minute ?? "0"),
    second: Number(bag.second ?? "0"),
  };
}

export function dateKeyInZone(date: Date, timeZone: string): string {
  const p = getZonedParts(date, timeZone);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

export function addIsoDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return `${utc.getUTCFullYear()}-${pad2(utc.getUTCMonth() + 1)}-${pad2(utc.getUTCDate())}`;
}

export function parseIsoDate(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

/** Convert a civil wall time in `timeZone` to an absolute Date. Handles DST. */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
): Date {
  const tz = resolveTimeZone(timeZone);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset1 = getTimezoneOffsetMinutes(tz, new Date(utcGuess));
  let utc = utcGuess - offset1 * 60_000;
  const offset2 = getTimezoneOffsetMinutes(tz, new Date(utc));
  if (offset1 !== offset2) {
    utc = utcGuess - offset2 * 60_000;
  }
  return new Date(utc);
}

export function startOfZonedDay(isoDate: string, timeZone: string): Date {
  const { year, month, day } = parseIsoDate(isoDate);
  return zonedTimeToUtc(year, month, day, 0, 0, 0, timeZone);
}

export function minutesOfDay(date: Date, timeZone: string): number {
  const p = getZonedParts(date, timeZone);
  return p.hour * 60 + p.minute + p.second / 60;
}

export function timeOfDayProgress(date: Date, timeZone: string): number {
  const p = getZonedParts(date, timeZone);
  return (p.hour * 3600 + p.minute * 60 + p.second) / 86400;
}

export function formatGmtOffset(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  if (mins === 0) return `GMT${sign}${hours}`;
  return `GMT${sign}${hours}:${pad2(mins)}`;
}

export function cityFromTimeZone(timeZone: string): string {
  if (timeZone === "UTC") return "UTC";
  const leaf = timeZone.split("/").pop() ?? timeZone;
  return leaf.replace(/_/g, " ");
}

export function friendlyTimeZoneLabel(timeZone: string, at: Date = new Date(), isLocal = false): string {
  const tz = resolveTimeZone(timeZone);
  const offset = formatGmtOffset(getTimezoneOffsetMinutes(tz, at));
  const city = cityFromTimeZone(tz);
  const region = REGION_BY_ZONE[tz];
  const core = region && region !== city ? `${region} — ${city} (${offset})` : `${city} (${offset})`;
  return isLocal ? `Local — ${core}` : core;
}

export function formatTimeInZone(date: Date, timeZone: string, hourCycle: HourCycle): string {
  const tz = resolveTimeZone(timeZone);
  if (hourCycle === "h24") {
    const p = getZonedParts(date, tz);
    return `${pad2(p.hour)}:${pad2(p.minute)}`;
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatDateLongInZone(date: Date, timeZone: string, locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: resolveTimeZone(timeZone),
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function formatDurationMs(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60_000));
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours <= 0) return `${pad2(mins)}m`;
  return `${pad2(hours)}h ${pad2(mins)}m`;
}

export function formatSessionHours(minutes: number): string {
  const hours = minutes / 60;
  if (Number.isInteger(hours)) return `${hours}h`;
  const h = Math.floor(hours);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export type TimeZoneOption = { value: string; label: string };

export function getMarketTimeZoneOptions(at: Date = new Date(), localTimeZone?: string): TimeZoneOption[] {
  const local = localTimeZone && isValidTimeZone(localTimeZone) ? localTimeZone : detectBrowserTimeZone();
  const seen = new Set<string>();
  const options: TimeZoneOption[] = [];

  function add(value: string, isLocal = false) {
    if (!isValidTimeZone(value) || seen.has(value)) return;
    seen.add(value);
    options.push({ value, label: friendlyTimeZoneLabel(value, at, isLocal) });
  }

  add(local, true);
  for (const tz of FEATURED_TIMEZONES) add(tz);

  for (const opt of getTimezoneOptions(at)) {
    if (seen.has(opt.value)) continue;
    seen.add(opt.value);
    options.push({
      value: opt.value,
      label: `${opt.value.replace(/_/g, " ")} (${formatUtcOffset(opt.offsetMinutes)})`,
    });
  }
  return options;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
