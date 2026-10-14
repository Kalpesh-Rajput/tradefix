export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type Timeframe = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d";

/** Minutes of market data per second, or one display candle per second. */
export type ReplaySpeed = 1 | 2 | 5 | 10 | 20 | 50 | 100 | "candle";

export type ReplayStatus = "idle" | "loading" | "paused" | "playing" | "buffering" | "ended" | "error";

export type ReplayState = {
  status: ReplayStatus;
  cursorMs: number;
  timeframe: Timeframe;
  speed: ReplaySpeed;
  minMs: number;
  endMs: number;
  error: string | null;
};

export interface CandleSource {
  /** Complete candles of `timeframe` whose bucket ends at or before `cutoffMs`; the latest `bars` of them. */
  history(timeframe: Timeframe, cutoffMs: number, bars: number): Promise<Candle[]>;
  /** 1-minute candles with `fromMs <= time < toMs`. */
  minutes(fromMs: number, toMs: number): Promise<Candle[]>;
}

export interface ReplayClock {
  now(): number;
  setTimer(callback: () => void, delayMs: number): unknown;
  clearTimer(handle: unknown): void;
}

export type ReplayEvent =
  | { type: "reset"; candles: readonly Candle[] }
  | { type: "candles"; candles: readonly Candle[] }
  | { type: "minutes"; minutes: readonly Candle[] }
  | { type: "state"; state: ReplayState };
