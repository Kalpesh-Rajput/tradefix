import type { Candle, ReplaySpeed, Timeframe } from "./types";

export const MINUTE_MS = 60_000;

export const TIMEFRAME_MINUTES: Record<Timeframe, number> = {
  "1m": 1,
  "5m": 5,
  "15m": 15,
  "30m": 30,
  "1h": 60,
  "4h": 240,
  "1d": 1440,
};

export const TIMEFRAMES = Object.keys(TIMEFRAME_MINUTES) as Timeframe[];

export const REPLAY_SPEEDS: ReplaySpeed[] = [1, 2, 5, 10, 20, 50, 100, "candle"];

export function isTimeframe(value: unknown): value is Timeframe {
  return typeof value === "string" && value in TIMEFRAME_MINUTES;
}

export function timeframeMs(timeframe: Timeframe): number {
  return TIMEFRAME_MINUTES[timeframe] * MINUTE_MS;
}

/** UTC-epoch aligned, matching the server's aggregation. */
export function bucketStart(timeMs: number, timeframe: Timeframe): number {
  const step = timeframeMs(timeframe);
  return timeMs - (((timeMs % step) + step) % step);
}

export function floorMinute(timeMs: number): number {
  return bucketStart(timeMs, "1m");
}

export function startCandle(minute: Candle, timeframe: Timeframe): Candle {
  return { ...minute, time: bucketStart(minute.time, timeframe) };
}

/** Merges a later 1-minute candle into the forming candle of the same bucket. */
export function mergeMinute(forming: Candle, minute: Candle): Candle {
  return {
    time: forming.time,
    open: forming.open,
    high: Math.max(forming.high, minute.high),
    low: Math.min(forming.low, minute.low),
    close: minute.close,
    volume: forming.volume + minute.volume,
  };
}

export function aggregateMinutes(minutes: readonly Candle[], timeframe: Timeframe): Candle[] {
  const out: Candle[] = [];
  for (const minute of minutes) {
    const last = out[out.length - 1];
    const bucket = bucketStart(minute.time, timeframe);
    if (last && last.time === bucket) out[out.length - 1] = mergeMinute(last, minute);
    else out.push(startCandle(minute, timeframe));
  }
  return out;
}

export function speedLabel(speed: ReplaySpeed): string {
  return speed === "candle" ? "1 candle/s" : `${speed}×`;
}
