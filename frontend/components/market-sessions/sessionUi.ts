import { formatDurationMs } from "@/lib/market-sessions/timezone";
import type { MarketSessionId, MarketSessionSnapshot, SessionRowView } from "@/lib/market-sessions/types";

export function rowById(snapshot: MarketSessionSnapshot, id: MarketSessionId | string | undefined): SessionRowView | null {
  if (!id) return null;
  return snapshot.rows.find((r) => r.def.id === id) ?? null;
}

export function openRows(snapshot: MarketSessionSnapshot): SessionRowView[] {
  return snapshot.rows.filter((r) => r.isOpen);
}

/** Elapsed percent of the live session window, or null when closed. */
export function sessionElapsedPct(row: SessionRowView): number | null {
  if (!row.isOpen || row.closesInMs == null) return null;
  const total = row.durationMinutes * 60_000;
  if (total <= 0) return null;
  return Math.max(0, Math.min(100, ((total - row.closesInMs) / total) * 100));
}

export function buildMarketInsights(snapshot: MarketSessionSnapshot, now: Date): string[] {
  const active = openRows(snapshot);
  const insights: string[] = [];

  if (active.length === 1) {
    insights.push(`${active[0].def.name} session is currently active.`);
  } else if (active.length > 1) {
    insights.push(`${active.length} major sessions are currently active.`);
  } else if (snapshot.nextOpen) {
    insights.push(
      `No major session is active. ${snapshot.nextOpen.name} opens in ${formatDurationMs(snapshot.nextOpen.inMs)}.`
    );
  }

  const overlap = snapshot.currentOverlaps[0];
  if (overlap) {
    insights.push(`${overlap.names} overlap is active.`);
  } else if (snapshot.nextOverlap) {
    insights.push(
      `${snapshot.nextOverlap.names} overlap begins in ${formatDurationMs(snapshot.nextOverlap.start.getTime() - now.getTime())}.`
    );
  }

  if (snapshot.nextOpen && active.length > 0) {
    insights.push(`${snapshot.nextOpen.name} is the next session.`);
  }

  return insights.slice(0, 3);
}
