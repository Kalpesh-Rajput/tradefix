/** IANA timezones with UTC offset labels, e.g. `UTC (UTC+00:00)`. */

export type TimezoneOption = {
  value: string;
  label: string;
  offsetMinutes: number;
};

function pad(n: number): string {
  return String(Math.abs(n)).padStart(2, "0");
}

/** Format minutes east of UTC as `UTC+05:30` / `UTC-04:00` / `UTC+00:00`. */
export function formatUtcOffset(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  return `UTC${sign}${pad(hours)}:${pad(mins)}`;
}

/** Current offset for a zone (accounts for DST at `at`). */
export function getTimezoneOffsetMinutes(timeZone: string, at: Date = new Date()): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset",
    });
    const part = dtf.formatToParts(at).find((p) => p.type === "timeZoneName")?.value;
    // "GMT", "GMT+5", "GMT+05:30", "GMT-4"
    if (!part || part === "GMT" || part === "UTC") return 0;
    const match = part.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
    if (!match) return 0;
    const sign = match[1] === "-" ? -1 : 1;
    const hours = Number(match[2]);
    const mins = Number(match[3] || "0");
    return sign * (hours * 60 + mins);
  } catch {
    return 0;
  }
}

export function formatTimezoneLabel(timeZone: string, at: Date = new Date()): string {
  const offset = formatUtcOffset(getTimezoneOffsetMinutes(timeZone, at));
  return `${timeZone} (${offset})`;
}

function listIanaTimeZones(): string[] {
  try {
    if (typeof Intl !== "undefined" && "supportedValuesOf" in Intl) {
      const zones = Intl.supportedValuesOf("timeZone");
      const set = new Set(zones);
      // Ensure common aliases appear even if the engine omits them
      set.add("UTC");
      return Array.from(set);
    }
  } catch {
    /* fall through */
  }
  return FALLBACK_TIMEZONES;
}

let _cache: TimezoneOption[] | null = null;

export function getTimezoneOptions(at: Date = new Date()): TimezoneOption[] {
  if (_cache) {
    // Refresh labels/offsets for current DST without rebuilding the zone list
    return _cache.map((opt) => {
      const offsetMinutes = getTimezoneOffsetMinutes(opt.value, at);
      return {
        value: opt.value,
        offsetMinutes,
        label: `${opt.value} (${formatUtcOffset(offsetMinutes)})`,
      };
    });
  }

  const options = listIanaTimeZones().map((value) => {
    const offsetMinutes = getTimezoneOffsetMinutes(value, at);
    return {
      value,
      offsetMinutes,
      label: `${value} (${formatUtcOffset(offsetMinutes)})`,
    };
  });

  options.sort((a, b) => {
    if (a.offsetMinutes !== b.offsetMinutes) return a.offsetMinutes - b.offsetMinutes;
    return a.value.localeCompare(b.value);
  });

  // Keep UTC near the top for discoverability
  const utcIdx = options.findIndex((o) => o.value === "UTC");
  if (utcIdx > 0) {
    const [utc] = options.splice(utcIdx, 1);
    options.unshift(utc);
  }

  _cache = options;
  return options;
}

/** Minimal fallback if `Intl.supportedValuesOf` is unavailable. */
const FALLBACK_TIMEZONES = [
  "UTC",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Africa/Nairobi",
  "America/Anchorage",
  "America/Argentina/Buenos_Aires",
  "America/Bogota",
  "America/Caracas",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/New_York",
  "America/Phoenix",
  "America/Sao_Paulo",
  "America/Toronto",
  "America/Vancouver",
  "Asia/Bangkok",
  "Asia/Dubai",
  "Asia/Hong_Kong",
  "Asia/Jakarta",
  "Asia/Jerusalem",
  "Asia/Kolkata",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Melbourne",
  "Australia/Perth",
  "Australia/Sydney",
  "Europe/Amsterdam",
  "Europe/Berlin",
  "Europe/Istanbul",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Moscow",
  "Europe/Paris",
  "Pacific/Auckland",
  "Pacific/Honolulu",
];
