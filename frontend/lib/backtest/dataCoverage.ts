import { pairLabel } from "./hubStats";
import type { MarketInstrument } from "./sessions";

export type CoverageEntry = { symbol: string; label: string; fromMs: number; toMs: number };

export type DataCoverage = {
  entries: CoverageEntry[];
  fromMs: number | null;
  toMs: number | null;
};

export function summarizeCoverage(instruments: readonly MarketInstrument[]): DataCoverage {
  const entries = instruments
    .filter((item) => item.enabled && item.data_from_ms != null && item.data_to_ms != null && item.data_to_ms > item.data_from_ms)
    .map((item) => ({
      symbol: item.symbol,
      label: pairLabel(item.symbol),
      fromMs: item.data_from_ms as number,
      toMs: item.data_to_ms as number,
    }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
  if (entries.length === 0) return { entries, fromMs: null, toMs: null };
  return {
    entries,
    fromMs: Math.min(...entries.map((entry) => entry.fromMs)),
    toMs: Math.max(...entries.map((entry) => entry.toMs)),
  };
}

export function formatCoverageDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
