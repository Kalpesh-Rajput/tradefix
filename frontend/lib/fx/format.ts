import type { HourCycle } from "@/lib/market-sessions/types";

import type { FxFreshness } from "./types";

export function freshnessLabel(
  freshness: FxFreshness,
  delayed: boolean
): { label: string; tone: "ok" | "warn" | "stale" } {
  if (freshness === "stale") return { label: "Showing last available rate", tone: "stale" };
  if (freshness === "cached") return { label: delayed ? "Cached delayed rate" : "Cached rate", tone: "warn" };
  return { label: "Latest available rate", tone: "ok" };
}

export function roundTo(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** Math.max(0, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function convertAmount(amount: number, rate: number): number {
  return amount * rate;
}

export function invertRate(rate: number): number {
  if (!Number.isFinite(rate) || rate === 0) return NaN;
  return 1 / rate;
}

export function formatRate(rate: number): string {
  if (!Number.isFinite(rate)) return "—";
  if (rate >= 100) return rate.toFixed(2);
  if (rate >= 1) {
    const trimmed = rate.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
    const decimals = trimmed.split(".")[1]?.length ?? 0;
    return decimals < 2 ? rate.toFixed(2) : trimmed;
  }
  if (rate >= 0.01) return rate.toFixed(4);
  return rate.toFixed(6).replace(/0+$/, "").replace(/\.$/, "") || "0";
}

export function formatGroupedAmount(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return "—";
  const rounded = roundTo(value, decimals);
  const isInt = Number.isInteger(rounded);
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: isInt ? 0 : decimals,
    maximumFractionDigits: decimals,
  }).format(rounded);
}

export function formatMoney(value: number, symbol: string, decimals: number): string {
  return `${symbol}\u00a0${formatGroupedAmount(value, decimals)}`;
}

export function sanitizeAmountInput(raw: string): string | null {
  const stripped = raw.replace(/,/g, "").replace(/[^\d.]/g, "");
  if (stripped === "") return "";
  const firstDot = stripped.indexOf(".");
  const compact =
    firstDot === -1
      ? stripped
      : `${stripped.slice(0, firstDot)}.${stripped.slice(firstDot + 1).replace(/\./g, "")}`;
  const [intPart = "", decPart] = compact.split(".");
  if (intPart.length > 12) return null;
  if (decPart != null && decPart.length > 8) return null;
  if (!/^\d*$/.test(intPart) || (decPart != null && !/^\d*$/.test(decPart))) return null;
  return decPart != null ? `${intPart}.${decPart}` : intPart;
}

export function parseAmount(raw: string): number | null {
  const sanitized = sanitizeAmountInput(raw);
  if (sanitized == null || sanitized === "" || sanitized === ".") return null;
  const value = Number(sanitized);
  if (!Number.isFinite(value)) return null;
  return value;
}

export function formatAbsoluteTimestamp(
  value: string | Date,
  timeZone: string,
  hourCycle: HourCycle
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: hourCycle === "h24" ? "h23" : "h12",
      timeZoneName: "short",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export function formatRelativeTimestamp(from: Date | string, now: Date): string {
  const date = from instanceof Date ? from : new Date(from);
  if (Number.isNaN(date.getTime())) return "";
  const sec = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
  if (sec < 8) return "just now";
  if (sec < 60) return `${sec} seconds ago`;
  const min = Math.round(sec / 60);
  if (min === 1) return "1 min ago";
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr === 1) return "1 hour ago";
  if (hr < 48) return `${hr} hours ago`;
  const days = Math.round(hr / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

export function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
