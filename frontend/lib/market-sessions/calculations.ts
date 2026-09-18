import { MARKET_SESSIONS } from "@/lib/market-sessions/sessions";
import {
  addIsoDays,
  dateKeyInZone,
  minutesOfDay,
  startOfZonedDay,
  timeOfDayProgress,
  zonedTimeToUtc,
} from "@/lib/market-sessions/timezone";
import type {
  MarketSessionDef,
  MarketSessionId,
  MarketSessionSnapshot,
  NextSessionEvent,
  SessionOccurrence,
  SessionOverlap,
  SessionRowView,
  TimelineSegment,
  TradeSessionInfo,
} from "@/lib/market-sessions/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVITY_BUCKETS = 96;

function occurrenceOnLocalDate(def: MarketSessionDef, isoDate: string): SessionOccurrence {
  const [year, month, day] = isoDate.split("-").map(Number);
  const openHour = Math.floor(def.openMinutes / 60);
  const openMin = def.openMinutes % 60;
  const closeHour = Math.floor(def.closeMinutes / 60);
  const closeMin = def.closeMinutes % 60;
  const open = zonedTimeToUtc(year, month, day, openHour, openMin, 0, def.timezone);
  let close = zonedTimeToUtc(year, month, day, closeHour, closeMin, 0, def.timezone);
  if (close.getTime() <= open.getTime()) {
    const next = addIsoDays(isoDate, 1);
    const [ny, nm, nd] = next.split("-").map(Number);
    close = zonedTimeToUtc(ny, nm, nd, closeHour, closeMin, 0, def.timezone);
  }
  return { sessionId: def.id, open, close };
}

function isoRange(fromIso: string, toIso: string): string[] {
  const out: string[] = [];
  let cursor = fromIso;
  while (cursor <= toIso) {
    out.push(cursor);
    cursor = addIsoDays(cursor, 1);
  }
  return out;
}

export function occurrencesAround(
  def: MarketSessionDef,
  from: Date,
  to: Date,
  padDays = 2
): SessionOccurrence[] {
  const startIso = addIsoDays(dateKeyInZone(from, def.timezone), -padDays);
  const endIso = addIsoDays(dateKeyInZone(to, def.timezone), padDays);
  const hits: SessionOccurrence[] = [];
  for (const iso of isoRange(startIso, endIso)) {
    const occ = occurrenceOnLocalDate(def, iso);
    if (occ.open.getTime() < to.getTime() && occ.close.getTime() > from.getTime()) {
      hits.push(occ);
    }
  }
  return hits;
}

export function isSessionOpenAt(def: MarketSessionDef, at: Date): boolean {
  const iso = dateKeyInZone(at, def.timezone);
  for (const day of [addIsoDays(iso, -1), iso, addIsoDays(iso, 1)]) {
    const occ = occurrenceOnLocalDate(def, day);
    if (at.getTime() >= occ.open.getTime() && at.getTime() < occ.close.getTime()) return true;
  }
  return false;
}

export function getActiveSessions(
  at: Date,
  sessions: readonly MarketSessionDef[] = MARKET_SESSIONS
): MarketSessionDef[] {
  return sessions.filter((s) => isSessionOpenAt(s, at));
}

export function getSessionStatus(
  session: MarketSessionDef,
  at: Date
): "open" | "closed" {
  return isSessionOpenAt(session, at) ? "open" : "closed";
}

export function getSessionOverlaps(
  at: Date,
  sessions: readonly MarketSessionDef[] = MARKET_SESSIONS
): Array<[MarketSessionDef, MarketSessionDef]> {
  const open = getActiveSessions(at, sessions);
  const pairs: Array<[MarketSessionDef, MarketSessionDef]> = [];
  for (let i = 0; i < open.length; i += 1) {
    for (let j = i + 1; j < open.length; j += 1) {
      pairs.push([open[i], open[j]]);
    }
  }
  return pairs;
}

export function nextOccurrenceOpen(
  def: MarketSessionDef,
  at: Date
): SessionOccurrence {
  const iso = dateKeyInZone(at, def.timezone);
  for (let i = 0; i < 4; i += 1) {
    const occ = occurrenceOnLocalDate(def, addIsoDays(iso, i));
    if (occ.open.getTime() > at.getTime()) return occ;
  }
  return occurrenceOnLocalDate(def, addIsoDays(iso, 4));
}

export function currentOrNextOccurrence(
  def: MarketSessionDef,
  at: Date
): { current: SessionOccurrence | null; next: SessionOccurrence } {
  const iso = dateKeyInZone(at, def.timezone);
  let current: SessionOccurrence | null = null;
  let next: SessionOccurrence | null = null;
  for (let i = -1; i <= 4; i += 1) {
    const occ = occurrenceOnLocalDate(def, addIsoDays(iso, i));
    if (at.getTime() >= occ.open.getTime() && at.getTime() < occ.close.getTime()) {
      current = occ;
    }
    if (!next && occ.open.getTime() > at.getTime()) next = occ;
  }
  return { current, next: next ?? nextOccurrenceOpen(def, at) };
}

export function getNextSession(
  at: Date,
  sessions: readonly MarketSessionDef[] = MARKET_SESSIONS
): { def: MarketSessionDef; open: Date } | null {
  let best: { def: MarketSessionDef; open: Date } | null = null;
  for (const def of sessions) {
    const { next } = currentOrNextOccurrence(def, at);
    if (!best || next.open.getTime() < best.open.getTime()) {
      best = { def, open: next.open };
    }
  }
  return best;
}

export function getSessionsForTrade(
  entryTime: Date,
  exitTime?: Date | null,
  sessions: readonly MarketSessionDef[] = MARKET_SESSIONS
): TradeSessionInfo {
  const entrySessions = getActiveSessions(entryTime, sessions).map((s) => s.id);
  const exitSessions = exitTime ? getActiveSessions(exitTime, sessions).map((s) => s.id) : [];
  return {
    entrySessions,
    exitSessions,
    entryOverlap: entrySessions.length > 1,
    exitOverlap: exitSessions.length > 1,
  };
}

function clipSegments(
  occurrences: SessionOccurrence[],
  viewStart: Date,
  viewEnd: Date
): TimelineSegment[] {
  const viewMs = viewEnd.getTime() - viewStart.getTime();
  if (viewMs <= 0) return [];
  const segments: TimelineSegment[] = [];
  for (const occ of occurrences) {
    const start = Math.max(occ.open.getTime(), viewStart.getTime());
    const end = Math.min(occ.close.getTime(), viewEnd.getTime());
    if (end <= start) continue;
    const startPct = ((start - viewStart.getTime()) / viewMs) * 100;
    const endPct = ((end - viewStart.getTime()) / viewMs) * 100;
    if (endPct - startPct < 0.15) continue;
    segments.push({
      startPct: Math.max(0, startPct),
      endPct: Math.min(100, endPct),
    });
  }
  return segments;
}

function overlapInterval(
  a: SessionOccurrence,
  b: SessionOccurrence
): { start: Date; end: Date } | null {
  const start = Math.max(a.open.getTime(), b.open.getTime());
  const end = Math.min(a.close.getTime(), b.close.getTime());
  if (end <= start) return null;
  return { start: new Date(start), end: new Date(end) };
}

function collectOverlaps(
  sessions: readonly MarketSessionDef[],
  from: Date,
  to: Date
): SessionOverlap[] {
  const occs = sessions.map((def) => ({
    def,
    list: occurrencesAround(def, from, to, 2),
  }));
  const overlaps: SessionOverlap[] = [];
  for (let i = 0; i < occs.length; i += 1) {
    for (let j = i + 1; j < occs.length; j += 1) {
      for (const a of occs[i].list) {
        for (const b of occs[j].list) {
          const hit = overlapInterval(a, b);
          if (!hit) continue;
          overlaps.push({
            ids: [occs[i].def.id, occs[j].def.id],
            names: `${occs[i].def.name} + ${occs[j].def.name}`,
            start: hit.start,
            end: hit.end,
          });
        }
      }
    }
  }
  overlaps.sort((a, b) => a.start.getTime() - b.start.getTime());
  return overlaps;
}

function activityBuckets(
  sessions: readonly MarketSessionDef[],
  viewStart: Date,
  viewEnd: Date
): number[] {
  const buckets = Array.from({ length: ACTIVITY_BUCKETS }, () => 0);
  const span = viewEnd.getTime() - viewStart.getTime();
  if (span <= 0) return buckets;
  const step = span / ACTIVITY_BUCKETS;
  for (let i = 0; i < ACTIVITY_BUCKETS; i += 1) {
    const t = new Date(viewStart.getTime() + i * step + step / 2);
    buckets[i] = getActiveSessions(t, sessions).length;
  }
  return buckets;
}

export function buildMarketSessionSnapshot(opts: {
  now: Date;
  viewTimeZone: string;
  viewDate: string;
  sessions?: readonly MarketSessionDef[];
}): MarketSessionSnapshot {
  const sessions = opts.sessions ?? MARKET_SESSIONS;
  const viewStart = startOfZonedDay(opts.viewDate, opts.viewTimeZone);
  const viewEnd = new Date(viewStart.getTime() + DAY_MS);
  const todayKey = dateKeyInZone(opts.now, opts.viewTimeZone);
  const isToday = todayKey === opts.viewDate;
  const active = getActiveSessions(opts.now, sessions);

  const rows: SessionRowView[] = sessions.map((def) => {
    const occs = occurrencesAround(def, viewStart, viewEnd, 2);
    const { current, next } = currentOrNextOccurrence(def, opts.now);
    const displayOcc =
      occs.find((o) => o.close.getTime() > viewStart.getTime() && o.open.getTime() < viewEnd.getTime()) ??
      current ??
      next;
    const isOpen = current != null;
    return {
      def,
      open: displayOcc.open,
      close: displayOcc.close,
      durationMinutes: Math.round((displayOcc.close.getTime() - displayOcc.open.getTime()) / 60_000),
      isOpen,
      segments: clipSegments(occs, viewStart, viewEnd),
      opensInMs: isOpen ? null : Math.max(0, next.open.getTime() - opts.now.getTime()),
      closesInMs: current ? Math.max(0, current.close.getTime() - opts.now.getTime()) : null,
    };
  });

  let nextOpen: NextSessionEvent | null = null;
  let nextClose: NextSessionEvent | null = null;
  for (const row of rows) {
    if (row.isOpen && row.closesInMs != null) {
      if (!nextClose || row.closesInMs < nextClose.inMs) {
        nextClose = {
          id: row.def.id,
          name: row.def.name,
          at: new Date(opts.now.getTime() + row.closesInMs),
          inMs: row.closesInMs,
          kind: "close",
        };
      }
    }
    if (!row.isOpen && row.opensInMs != null) {
      if (!nextOpen || row.opensInMs < nextOpen.inMs) {
        nextOpen = {
          id: row.def.id,
          name: row.def.name,
          at: new Date(opts.now.getTime() + row.opensInMs),
          inMs: row.opensInMs,
          kind: "open",
        };
      }
    }
  }

  const overlapHorizonEnd = new Date(opts.now.getTime() + 3 * DAY_MS);
  const allOverlaps = collectOverlaps(sessions, opts.now, overlapHorizonEnd);
  const currentOverlaps = allOverlaps.filter(
    (o) => o.start.getTime() <= opts.now.getTime() && o.end.getTime() > opts.now.getTime()
  );
  const nextOverlap =
    allOverlaps.find((o) => o.start.getTime() > opts.now.getTime()) ?? null;

  return {
    viewDate: opts.viewDate,
    viewTimeZone: opts.viewTimeZone,
    isToday,
    currentProgress: isToday ? timeOfDayProgress(opts.now, opts.viewTimeZone) : minutesOfDay(viewStart, opts.viewTimeZone) / 1440,
    rows,
    activeIds: active.map((s) => s.id),
    nextOpen,
    nextClose,
    currentOverlaps,
    nextOverlap,
    activity: activityBuckets(sessions, viewStart, viewEnd),
  };
}

export { minutesOfDay, timeOfDayProgress };
