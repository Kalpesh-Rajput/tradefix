import type { MarketInstrument } from "@/lib/backtest/sessions";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const DEFAULT_SPAN_DAYS = 5;

export type SessionWindow = { start: number; end: number };

export function hasStoredData(instrument: MarketInstrument | undefined): instrument is MarketInstrument & { data_from_ms: number; data_to_ms: number } {
  return !!instrument && instrument.data_from_ms != null && instrument.data_to_ms != null && instrument.data_to_ms > instrument.data_from_ms;
}

/** The most recent working week that sits fully inside the instrument's stored candles. */
export function defaultWindow(instrument: MarketInstrument | undefined): SessionWindow | null {
  if (!hasStoredData(instrument)) return null;
  const end = Math.floor(instrument.data_to_ms / HOUR_MS) * HOUR_MS - DAY_MS;
  const start = Math.max(instrument.data_from_ms, end - DEFAULT_SPAN_DAYS * DAY_MS);
  return end > start ? { start, end } : { start: instrument.data_from_ms, end: instrument.data_to_ms };
}

export function windowFits(instrument: MarketInstrument | undefined, start: number, end: number | null): boolean {
  if (!hasStoredData(instrument)) return true;
  return start >= instrument.data_from_ms && start < instrument.data_to_ms && (end == null || end <= instrument.data_to_ms);
}

export function formatDataRange(instrument: MarketInstrument | undefined): string | null {
  if (!hasStoredData(instrument)) return null;
  const fmt = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  return `${fmt(instrument.data_from_ms)} to ${fmt(instrument.data_to_ms)}`;
}

export function toLocalInput(ms: number): string {
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
