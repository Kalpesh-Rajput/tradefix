import type { DateFormat } from "@/lib/i18n";
import { languageMeta } from "@/lib/i18n";

export type LocalePrefs = {
  language: string;
  timezone: string;
  dateFormat: DateFormat;
};

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

function partsInZone(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const bag: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") bag[p.type] = p.value;
  }
  // Intl may emit hour "24" for midnight in some environments
  if (bag.hour === "24") bag.hour = "00";
  return bag;
}

/** Calendar day key `YYYY-MM-DD` in the user's timezone. */
export function dateKeyInTimezone(value: Date | string | number, timeZone: string): string {
  const bag = partsInZone(toDate(value), timeZone);
  return `${bag.year}-${bag.month}-${bag.day}`;
}

export function formatDate(
  value: Date | string | number | null | undefined,
  prefs: LocalePrefs
): string {
  if (value == null || value === "") return "—";
  const bag = partsInZone(toDate(value), prefs.timezone);
  switch (prefs.dateFormat) {
    case "DD/MM/YYYY":
      return `${bag.day}/${bag.month}/${bag.year}`;
    case "YYYY-MM-DD":
      return `${bag.year}-${bag.month}-${bag.day}`;
    default:
      return `${bag.month}/${bag.day}/${bag.year}`;
  }
}

export function formatTime(
  value: Date | string | number | null | undefined,
  prefs: LocalePrefs,
  opts?: { seconds?: boolean }
): string {
  if (value == null || value === "") return "—";
  const locale = languageMeta(prefs.language).locale;
  return toDate(value).toLocaleTimeString(locale, {
    timeZone: prefs.timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: opts?.seconds ? "2-digit" : undefined,
  });
}

export function formatDateTime(
  value: Date | string | number | null | undefined,
  prefs: LocalePrefs
): string {
  if (value == null || value === "") return "—";
  return `${formatDate(value, prefs)} ${formatTime(value, prefs)}`;
}

/** Long localized date, e.g. Friday, July 31, 2026 — respects language + timezone. */
export function formatDateLong(
  value: Date | string | number | null | undefined,
  prefs: LocalePrefs
): string {
  if (value == null || value === "") return "—";
  const locale = languageMeta(prefs.language).locale;
  return toDate(value).toLocaleDateString(locale, {
    timeZone: prefs.timezone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** SuperTrader-style header: "FRIDAY, JULY 31" in the user's language/timezone. */
export function formatTodayLabelShort(prefs: LocalePrefs, value: Date = new Date()): string {
  const locale = languageMeta(prefs.language).locale;
  return value
    .toLocaleDateString(locale, {
      timeZone: prefs.timezone,
      weekday: "long",
      month: "long",
      day: "numeric",
    })
    .toUpperCase();
}

export function formatChartDate(
  value: Date | string | number,
  prefs: LocalePrefs,
  style: "short" | "monthYear" = "short"
): string {
  const locale = languageMeta(prefs.language).locale;
  const d = toDate(value);
  if (style === "monthYear") {
    return d.toLocaleDateString(locale, {
      timeZone: prefs.timezone,
      month: "short",
      year: "2-digit",
    });
  }
  return d.toLocaleDateString(locale, {
    timeZone: prefs.timezone,
    month: "short",
    day: "numeric",
  });
}

export function formatMonthYear(value: Date | string | number, prefs: LocalePrefs): string {
  const locale = languageMeta(prefs.language).locale;
  return toDate(value).toLocaleDateString(locale, {
    timeZone: prefs.timezone,
    month: "long",
    year: "numeric",
  });
}

/** Convert ISO → `YYYY-MM-DDTHH:mm` for datetime-local, in user timezone. */
export function toTimezoneDatetimeInput(
  iso: string | null | undefined,
  timeZone: string
): string {
  if (!iso) return "";
  const bag = partsInZone(toDate(iso), timeZone);
  return `${bag.year}-${bag.month}-${bag.day}T${bag.hour}:${bag.minute}`;
}

export function fmtMoney(
  n: number,
  prefs: LocalePrefs,
  opts?: { signed?: boolean; digits?: number }
) {
  const signed = opts?.signed ?? true;
  const digits = opts?.digits ?? 2;
  const locale = languageMeta(prefs.language).locale;
  const abs = Math.abs(n).toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  if (!signed) return `$${abs}`;
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}$${abs}`;
}
