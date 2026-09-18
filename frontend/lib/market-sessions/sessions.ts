import type { MarketSessionDef } from "@/lib/market-sessions/types";

/**
 * Major FX cash-market windows in each city's local civil time.
 * Offsets (including DST) come from the IANA zone — wall-clock hours stay fixed.
 */
export const MARKET_SESSIONS: readonly MarketSessionDef[] = [
  {
    id: "sydney",
    name: "Sydney",
    city: "Sydney",
    timezone: "Australia/Sydney",
    openMinutes: 7 * 60,
    closeMinutes: 16 * 60,
    color: "#3B6AE0",
  },
  {
    id: "tokyo",
    name: "Tokyo",
    city: "Tokyo",
    timezone: "Asia/Tokyo",
    openMinutes: 9 * 60,
    closeMinutes: 18 * 60,
    color: "#7C5CBF",
  },
  {
    id: "london",
    name: "London",
    city: "London",
    timezone: "Europe/London",
    openMinutes: 8 * 60,
    closeMinutes: 17 * 60,
    color: "#2A9B8F",
  },
  {
    id: "new_york",
    name: "New York",
    city: "New York",
    timezone: "America/New_York",
    openMinutes: 8 * 60,
    closeMinutes: 17 * 60,
    color: "#3D8B62",
  },
];

export const SESSION_BY_ID: Readonly<Record<string, MarketSessionDef>> = Object.fromEntries(
  MARKET_SESSIONS.map((s) => [s.id, s])
);

export function getMarketSessions(): readonly MarketSessionDef[] {
  return MARKET_SESSIONS;
}
