import { MINUTE_MS, bucketStart, floorMinute, mergeMinute, startCandle, timeframeMs } from "./timeframes";
import type {
  Candle,
  CandleSource,
  ReplayClock,
  ReplayEvent,
  ReplaySpeed,
  ReplayState,
  ReplayStatus,
  Timeframe,
} from "./types";

export const REPLAY_DEFAULTS = {
  historyBars: 300,
  chunkMinutes: 1500,
  prefetchThreshold: 500,
  tickMs: 50,
  maxStepsPerTick: 50,
  maxBacklogSeconds: 2,
  maxCandles: 10_000,
};

export const systemClock: ReplayClock = {
  now: () => (typeof performance !== "undefined" ? performance.now() : Date.now()),
  setTimer: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export type ReplayEngineOptions = {
  source: CandleSource;
  timeframe: Timeframe;
  startMs: number;
  minMs: number;
  endMs: number;
  speed?: ReplaySpeed;
  clock?: ReplayClock;
  /** Rewinding (step back, seek or reset to an earlier time) is refused while this returns false. */
  canRewind?: () => boolean;
} & Partial<typeof REPLAY_DEFAULTS>;

type StepResult = "ok" | "starved" | "ended";
type BucketStep = { target: number | null; consumedAny: boolean };

const byTime = (a: Candle, b: Candle) => a.time - b.time;

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Market data could not be loaded.";
}

/**
 * Owns replay time, buffers and the forming candle. Nothing at or after the cursor is ever exposed:
 * visible candles are built only from 1-minute candles with `time < cursor`.
 */
export class ReplayEngine {
  private readonly source: CandleSource;
  private readonly clock: ReplayClock;
  private readonly opts: typeof REPLAY_DEFAULTS;
  private readonly canRewind: () => boolean;
  readonly startMs: number;
  readonly minMs: number;
  readonly endMs: number;

  private status: ReplayStatus = "idle";
  private error: string | null = null;
  private cursor: number;
  private tf: Timeframe;
  private speed: ReplaySpeed;

  private history: Candle[] = [];
  private forming: Candle | null = null;

  private buffer: Candle[] = [];
  private head = 0;
  private fetchedUntil: number;
  private fetching: Promise<void> | null = null;
  private bufferGen = 0;
  private viewGen = 0;

  private timer: unknown = null;
  private lastTick = 0;
  private backlog = 0;
  private resumeAfterLoad = false;
  private destroyed = false;
  private retryOp: (() => Promise<unknown>) | null = null;

  private listeners = new Set<(event: ReplayEvent) => void>();
  private touched = new Map<number, Candle>();
  private consumed: Candle[] = [];
  private needsReset = false;

  constructor(options: ReplayEngineOptions) {
    this.source = options.source;
    this.clock = options.clock ?? systemClock;
    this.canRewind = options.canRewind ?? (() => true);
    this.opts = {
      historyBars: options.historyBars ?? REPLAY_DEFAULTS.historyBars,
      chunkMinutes: options.chunkMinutes ?? REPLAY_DEFAULTS.chunkMinutes,
      prefetchThreshold: options.prefetchThreshold ?? REPLAY_DEFAULTS.prefetchThreshold,
      tickMs: options.tickMs ?? REPLAY_DEFAULTS.tickMs,
      maxStepsPerTick: options.maxStepsPerTick ?? REPLAY_DEFAULTS.maxStepsPerTick,
      maxBacklogSeconds: options.maxBacklogSeconds ?? REPLAY_DEFAULTS.maxBacklogSeconds,
      maxCandles: options.maxCandles ?? REPLAY_DEFAULTS.maxCandles,
    };
    this.minMs = floorMinute(options.minMs);
    this.endMs = floorMinute(options.endMs);
    this.startMs = this.clamp(options.startMs);
    this.cursor = this.startMs;
    this.fetchedUntil = this.startMs;
    this.tf = options.timeframe;
    this.speed = options.speed ?? 10;
  }

  subscribe(listener: (event: ReplayEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState(): ReplayState {
    return {
      status: this.status,
      cursorMs: this.cursor,
      timeframe: this.tf,
      speed: this.speed,
      minMs: this.minMs,
      endMs: this.endMs,
      error: this.error,
    };
  }

  candles(): Candle[] {
    return this.forming ? [...this.history, this.forming] : [...this.history];
  }

  load(): Promise<void> {
    return this.rebuild(this.startMs, false, false);
  }

  play() {
    if (this.destroyed) return;
    if (this.status === "loading") {
      this.resumeAfterLoad = true;
      return;
    }
    if (this.status !== "paused") return;
    this.lastTick = this.clock.now();
    this.backlog = 0;
    if (!this.available()) {
      if (this.exhausted()) this.setStatus("ended");
      else this.setStatus("buffering");
      this.ensureBuffer();
      return;
    }
    this.setStatus("playing");
    this.ensureBuffer();
    this.schedule();
  }

  pause() {
    if (this.status === "loading") this.resumeAfterLoad = false;
    if (this.status !== "playing" && this.status !== "buffering") return;
    this.stopTimer();
    this.setStatus("paused");
  }

  toggle() {
    if (this.status === "playing" || this.status === "buffering") this.pause();
    else this.play();
  }

  setSpeed(speed: ReplaySpeed) {
    this.speed = speed;
    this.backlog = 0;
    this.emitState();
  }

  stepMinute(): Promise<boolean> {
    return this.stepWith(() => this.consumeNext());
  }

  stepCandle(): Promise<boolean> {
    const state: BucketStep = { target: null, consumedAny: false };
    return this.stepWith(() => this.consumeBucket(state));
  }

  stepBack(unit: "minute" | "candle"): Promise<boolean> {
    const target = unit === "minute" ? this.cursor - MINUTE_MS : bucketStart(this.cursor - 1, this.tf);
    return this.seek(target);
  }

  async seek(timeMs: number): Promise<boolean> {
    if (this.destroyed) return false;
    const target = this.clamp(timeMs);
    if (target < this.cursor && !this.canRewind()) return false;
    await this.rebuild(target, false, this.isRunning());
    return true;
  }

  reset(): Promise<boolean> {
    return this.seek(this.startMs);
  }

  async setTimeframe(timeframe: Timeframe): Promise<void> {
    if (this.destroyed || timeframe === this.tf) return;
    const resume = this.isRunning() || (this.status === "loading" && this.resumeAfterLoad);
    this.tf = timeframe;
    await this.rebuild(this.cursor, true, resume);
  }

  retry(): Promise<unknown> {
    if (this.status !== "error" || !this.retryOp) return Promise.resolve();
    const op = this.retryOp;
    this.retryOp = null;
    this.error = null;
    this.status = "paused";
    return op();
  }

  destroy() {
    this.destroyed = true;
    this.stopTimer();
    this.bufferGen += 1;
    this.viewGen += 1;
    this.listeners.clear();
  }

  private isRunning() {
    return this.status === "playing" || this.status === "buffering";
  }

  private clamp(timeMs: number): number {
    return Math.min(Math.max(floorMinute(timeMs), this.minMs), this.endMs);
  }

  private available() {
    return this.head < this.buffer.length;
  }

  private exhausted() {
    return !this.available() && this.fetchedUntil >= this.endMs;
  }

  private peek(): Candle | undefined {
    return this.buffer[this.head];
  }

  private async rebuild(target: number, keepForward: boolean, resume: boolean): Promise<void> {
    const time = this.clamp(target);
    this.stopTimer();
    const gen = ++this.viewGen;
    if (!keepForward) {
      this.bufferGen += 1;
      this.fetching = null;
      this.buffer = [];
      this.head = 0;
      this.fetchedUntil = time;
    }
    this.cursor = time;
    this.resumeAfterLoad = resume;
    this.error = null;
    this.setStatus("loading");
    const tf = this.tf;
    const step = timeframeMs(tf);
    const bucket = bucketStart(time, tf);
    try {
      const [history, minutes] = await Promise.all([
        this.source.history(tf, bucket, this.opts.historyBars),
        bucket < time ? this.source.minutes(bucket, time) : Promise.resolve([] as Candle[]),
      ]);
      if (gen !== this.viewGen || this.destroyed) return;
      const complete = history.filter((c) => c.time + step <= bucket).sort(byTime);
      this.history = dedupe(complete).slice(-this.opts.historyBars);
      this.forming = null;
      for (const minute of minutes.filter((m) => m.time >= bucket && m.time < time).sort(byTime)) {
        this.forming = this.forming ? mergeMinute(this.forming, minute) : startCandle(minute, tf);
      }
      this.touched.clear();
      this.consumed = [];
      this.needsReset = false;
      this.emit({ type: "reset", candles: this.candles() });
      const shouldPlay = this.resumeAfterLoad;
      this.resumeAfterLoad = false;
      this.status = "paused";
      if (this.exhausted()) this.setStatus("ended");
      else {
        this.setStatus("paused");
        if (shouldPlay) this.play();
      }
      this.ensureBuffer();
    } catch (error) {
      if (gen !== this.viewGen || this.destroyed) return;
      this.fail(error, () => this.rebuild(time, false, resume));
    }
  }

  private ensureBuffer() {
    if (this.fetching || this.destroyed || this.status === "error" || this.fetchedUntil >= this.endMs) return;
    if (this.buffer.length - this.head >= this.opts.prefetchThreshold) return;
    const gen = this.bufferGen;
    const from = this.fetchedUntil;
    const to = Math.min(this.endMs, from + this.opts.chunkMinutes * MINUTE_MS);
    this.fetching = this.source.minutes(from, to).then(
      (rows) => {
        if (gen !== this.bufferGen || this.destroyed) return;
        this.fetching = null;
        let lastTime = this.buffer.length ? this.buffer[this.buffer.length - 1].time : -Infinity;
        for (const row of rows.filter((r) => r.time >= from && r.time < to).sort(byTime)) {
          if (row.time <= lastTime) continue;
          this.buffer.push(row);
          lastTime = row.time;
        }
        this.fetchedUntil = to;
        this.afterData();
      },
      (error) => {
        if (gen !== this.bufferGen || this.destroyed) return;
        this.fetching = null;
        this.fail(error, async () => {
          this.ensureBuffer();
          await this.fetching;
        });
      }
    );
  }

  private afterData() {
    if (this.status === "buffering") {
      if (this.available()) {
        this.lastTick = this.clock.now();
        this.backlog = 0;
        this.setStatus("playing");
        this.schedule();
      } else if (this.exhausted()) {
        this.setStatus("ended");
      }
    }
    this.ensureBuffer();
  }

  private waitForData(): Promise<void> {
    this.ensureBuffer();
    return this.fetching ?? Promise.resolve();
  }

  private async stepWith(step: () => StepResult): Promise<boolean> {
    if (this.destroyed || this.status === "loading" || this.status === "idle" || this.status === "error") return false;
    this.pause();
    for (;;) {
      const result = step();
      if (result === "ok") {
        this.flush();
        this.ensureBuffer();
        return true;
      }
      if (result === "ended") {
        this.flush();
        this.setStatus("ended");
        return false;
      }
      const gen = this.bufferGen;
      await this.waitForData();
      if (gen !== this.bufferGen || this.destroyed || isStatus(this.status, "error") || isStatus(this.status, "loading")) {
        this.flush();
        return false;
      }
    }
  }

  private consumeNext(): StepResult {
    if (!this.peek()) return this.exhausted() ? "ended" : "starved";
    this.consume();
    return "ok";
  }

  private consumeBucket(state: BucketStep): StepResult {
    const step = timeframeMs(this.tf);
    for (;;) {
      const next = this.peek();
      if (!next) {
        if (state.target !== null && state.consumedAny && this.fetchedUntil >= state.target + step) return "ok";
        if (this.exhausted()) return state.consumedAny ? "ok" : "ended";
        return "starved";
      }
      const bucket = bucketStart(next.time, this.tf);
      if (state.target === null) state.target = bucket;
      if (bucket !== state.target) return "ok";
      this.consume();
      state.consumedAny = true;
    }
  }

  private consume() {
    const minute = this.buffer[this.head++];
    const bucket = bucketStart(minute.time, this.tf);
    if (this.forming && this.forming.time === bucket) {
      this.forming = mergeMinute(this.forming, minute);
    } else {
      if (this.forming) this.pushHistory(this.forming);
      this.forming = startCandle(minute, this.tf);
    }
    this.touched.set(this.forming.time, this.forming);
    this.consumed.push(minute);
    this.cursor = minute.time + MINUTE_MS;
    if (this.head > 4096) {
      this.buffer = this.buffer.slice(this.head);
      this.head = 0;
    }
  }

  private pushHistory(candle: Candle) {
    this.history.push(candle);
    this.touched.set(candle.time, candle);
    const slack = Math.max(1, Math.floor(this.opts.maxCandles * 0.1));
    if (this.history.length > this.opts.maxCandles + slack) {
      this.history = this.history.slice(-this.opts.maxCandles);
      this.needsReset = true;
    }
  }

  private flush() {
    if (this.needsReset) {
      this.emit({ type: "reset", candles: this.candles() });
    } else if (this.touched.size) {
      this.emit({ type: "candles", candles: [...this.touched.values()].sort(byTime) });
    }
    if (this.consumed.length) this.emit({ type: "minutes", minutes: this.consumed });
    this.touched = new Map();
    this.consumed = [];
    this.needsReset = false;
    this.emitState();
  }

  private schedule() {
    if (this.timer !== null || this.destroyed) return;
    this.timer = this.clock.setTimer(() => this.tick(), this.opts.tickMs);
  }

  private stopTimer() {
    if (this.timer !== null) this.clock.clearTimer(this.timer);
    this.timer = null;
  }

  private tick() {
    this.timer = null;
    if (this.status !== "playing" || this.destroyed) return;
    const now = this.clock.now();
    const elapsed = Math.max(0, now - this.lastTick);
    this.lastTick = now;
    const rate = (this.speed === "candle" ? 1 : this.speed) / 1000;
    const cap = Math.max(this.opts.maxStepsPerTick, rate * this.opts.maxBacklogSeconds * 1000);
    this.backlog = Math.min(this.backlog + elapsed * rate, cap);
    let steps = Math.min(Math.floor(this.backlog), this.opts.maxStepsPerTick);
    this.backlog -= steps;
    let result: StepResult = "ok";
    while (steps > 0) {
      result = this.speed === "candle" ? this.consumeBucket({ target: null, consumedAny: false }) : this.consumeNext();
      if (result !== "ok") break;
      steps -= 1;
    }
    if (result === "ended") this.status = "ended";
    else if (result === "starved") this.status = "buffering";
    this.flush();
    this.ensureBuffer();
    if (this.status === "playing") this.schedule();
  }

  private fail(error: unknown, retry: () => Promise<unknown>) {
    this.stopTimer();
    this.retryOp = retry;
    this.error = errorMessage(error);
    this.setStatus("error");
  }

  private setStatus(status: ReplayStatus) {
    this.status = status;
    this.emitState();
  }

  private emitState() {
    this.emit({ type: "state", state: this.getState() });
  }

  private emit(event: ReplayEvent) {
    for (const listener of this.listeners) listener(event);
  }
}

function isStatus(status: ReplayStatus, expected: ReplayStatus): boolean {
  return status === expected;
}

function dedupe(sorted: Candle[]): Candle[] {
  const out: Candle[] = [];
  for (const candle of sorted) {
    if (out.length && out[out.length - 1].time === candle.time) out[out.length - 1] = candle;
    else out.push(candle);
  }
  return out;
}
