export type HourCycle = "h12" | "h24";

export type MarketSessionId = "sydney" | "tokyo" | "london" | "new_york" | (string & {});

export type MarketSessionDef = {
  id: MarketSessionId;
  name: string;
  city: string;
  timezone: string;
  /** Minutes from local midnight. */
  openMinutes: number;
  /** Minutes from local midnight. If <= openMinutes, the session crosses midnight. */
  closeMinutes: number;
  color: string;
};

export type SessionOccurrence = {
  sessionId: MarketSessionId;
  open: Date;
  close: Date;
};

export type TimelineSegment = {
  startPct: number;
  endPct: number;
};

export type SessionOverlap = {
  ids: [MarketSessionId, MarketSessionId];
  names: string;
  start: Date;
  end: Date;
};

export type SessionRowView = {
  def: MarketSessionDef;
  open: Date;
  close: Date;
  durationMinutes: number;
  isOpen: boolean;
  segments: TimelineSegment[];
  opensInMs: number | null;
  closesInMs: number | null;
};

export type NextSessionEvent = {
  id: MarketSessionId;
  name: string;
  at: Date;
  inMs: number;
  kind: "open" | "close";
};

export type TradeSessionInfo = {
  entrySessions: MarketSessionId[];
  exitSessions: MarketSessionId[];
  entryOverlap: boolean;
  exitOverlap: boolean;
};

export type MarketSessionSnapshot = {
  viewDate: string;
  viewTimeZone: string;
  isToday: boolean;
  currentProgress: number;
  rows: SessionRowView[];
  activeIds: MarketSessionId[];
  nextOpen: NextSessionEvent | null;
  nextClose: NextSessionEvent | null;
  currentOverlaps: SessionOverlap[];
  nextOverlap: SessionOverlap | null;
  /** Typical overlap intensity in 15-minute buckets (0–n sessions). */
  activity: number[];
};
