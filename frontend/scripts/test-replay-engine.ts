/**
 * Replay engine guarantees (backtesting 04 section 3.4, 05 section 4).
 * Run: npx --yes tsx scripts/test-replay-engine.ts   (override the property seed with BT_SEED=<n>)
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { ReplayEngine, type ReplayEngineOptions } from "../lib/backtest/replayEngine";
import { mulberry32, pick, randomInt, seedFrom, type Rng } from "../lib/backtest/rng";
import { MINUTE_MS, TIMEFRAMES, aggregateMinutes, timeframeMs } from "../lib/backtest/timeframes";
import type { Candle, CandleSource, ReplayClock, ReplayEvent, ReplaySpeed, Timeframe } from "../lib/backtest/types";

const BASE = Date.UTC(2026, 1, 2);
const DAY = 1440 * MINUTE_MS;

function makeMinutes(rng: Rng, days: number): Candle[] {
  const out: Candle[] = [];
  let price = 100;
  const gapStart = BASE + randomInt(rng, 200, 1000) * MINUTE_MS;
  const gapEnd = gapStart + randomInt(rng, 60, 240) * MINUTE_MS;
  for (let i = 0; i < days * 1440; i += 1) {
    const time = BASE + i * MINUTE_MS;
    if (time >= gapStart && time < gapEnd) continue;
    if (rng() < 0.04) continue;
    const open = price;
    const close = Math.round((open + (rng() - 0.5) * 0.4) * 100) / 100;
    const high = Math.round((Math.max(open, close) + rng() * 0.2) * 100) / 100;
    const low = Math.round((Math.min(open, close) - rng() * 0.2) * 100) / 100;
    out.push({ time, open, high, low, close, volume: randomInt(rng, 1, 50) });
    price = close;
  }
  return out;
}

/** Independent re-statement of the server query: arg_min open, max high, min low, arg_max close, sum volume. */
function serverAggregate(minutes: readonly Candle[], tf: Timeframe): Candle[] {
  const step = timeframeMs(tf);
  const groups = new Map<number, Candle[]>();
  for (const m of minutes) {
    const key = m.time - (m.time % step);
    const list = groups.get(key) ?? [];
    list.push(m);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([time, list]) => {
      const ordered = [...list].sort((a, b) => a.time - b.time);
      return {
        time,
        open: ordered[0].open,
        high: Math.max(...ordered.map((m) => m.high)),
        low: Math.min(...ordered.map((m) => m.low)),
        close: ordered[ordered.length - 1].close,
        volume: ordered.reduce((sum, m) => sum + m.volume, 0),
      };
    });
}

class FakeServer implements CandleSource {
  calls = { history: 0, minutes: 0 };
  failNext = 0;
  constructor(readonly data: readonly Candle[]) {}
  history(tf: Timeframe, cutoffMs: number, bars: number): Promise<Candle[]> {
    this.calls.history += 1;
    if (this.failNext > 0) {
      this.failNext -= 1;
      return Promise.reject(new Error("network down"));
    }
    const step = timeframeMs(tf);
    const rows = serverAggregate(this.data.filter((m) => m.time < cutoffMs), tf).filter((c) => c.time + step <= cutoffMs);
    return Promise.resolve(rows.slice(-bars));
  }
  minutes(fromMs: number, toMs: number): Promise<Candle[]> {
    this.calls.minutes += 1;
    return Promise.resolve(this.data.filter((m) => m.time >= fromMs && m.time < toMs));
  }
}

class FakeClock implements ReplayClock {
  t = 0;
  private seq = 0;
  timers = new Map<number, { at: number; callback: () => void }>();
  now() {
    return this.t;
  }
  setTimer(callback: () => void, delayMs: number) {
    const id = ++this.seq;
    this.timers.set(id, { at: this.t + delayMs, callback });
    return id;
  }
  clearTimer(handle: unknown) {
    this.timers.delete(handle as number);
  }
  async advance(ms: number) {
    const target = this.t + ms;
    for (;;) {
      const next = [...this.timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > target) break;
      this.timers.delete(next[0]);
      this.t = next[1].at;
      next[1].callback();
      await settle();
    }
    this.t = target;
  }
  /** A throttled tab: time passes but no timer fires until the end. */
  async stall(ms: number) {
    this.t += ms;
    const due = [...this.timers.entries()];
    this.timers.clear();
    for (const [, timer] of due) timer.callback();
    await settle();
  }
}

async function settle() {
  for (let i = 0; i < 6; i += 1) await new Promise((resolve) => setImmediate(resolve));
}

/** Applies engine events the way the chart does: replace on reset, otherwise update-last or append only. */
class Mirror {
  candles: Candle[] = [];
  minutes: Candle[][] = [];
  apply = (event: ReplayEvent) => {
    if (event.type === "reset") this.candles = [...event.candles];
    if (event.type === "minutes") this.minutes.push([...event.minutes]);
    if (event.type !== "candles") return;
    for (const candle of event.candles) {
      const last = this.candles[this.candles.length - 1];
      if (!last || candle.time > last.time) this.candles.push(candle);
      else if (candle.time === last.time) this.candles[this.candles.length - 1] = candle;
      else assert.fail(`out-of-order chart update at ${candle.time} after ${last.time}`);
    }
  };
}

function engineFor(data: readonly Candle[], overrides: Partial<ReplayEngineOptions> = {}) {
  const server = new FakeServer(data);
  const clock = new FakeClock();
  const engine = new ReplayEngine({
    source: server,
    clock,
    timeframe: "5m",
    startMs: BASE + 600 * MINUTE_MS,
    minMs: BASE,
    endMs: data[data.length - 1].time + MINUTE_MS,
    historyBars: 120,
    chunkMinutes: 200,
    prefetchThreshold: 60,
    ...overrides,
  });
  const mirror = new Mirror();
  engine.subscribe(mirror.apply);
  return { engine, server, clock, mirror };
}

function assertMatchesServer(engine: ReplayEngine, data: readonly Candle[], mirror: Mirror, context: string) {
  const { cursorMs, timeframe } = engine.getState();
  const visible = engine.candles();
  const step = timeframeMs(timeframe);
  for (let i = 1; i < visible.length; i += 1) assert.ok(visible[i].time > visible[i - 1].time, `${context}: duplicate or unsorted`);
  for (const candle of visible) assert.ok(candle.time < cursorMs, `${context}: candle at or after cursor`);
  const reference = serverAggregate(data.filter((m) => m.time < cursorMs), timeframe);
  const first = visible.length ? visible[0].time : Infinity;
  const expected = reference.filter((c) => c.time >= first);
  assert.deepEqual(visible, expected, `${context}: visible candles differ from server aggregate`);
  const historyBuckets = reference.filter((c) => c.time + step <= cursorMs - (cursorMs % step));
  assert.ok(visible.length >= Math.min(historyBuckets.length, 120), `${context}: history missing`);
  assert.deepEqual(mirror.candles, visible, `${context}: chart events disagree with engine state`);
}

let checks = 0;

// lib/backtest stays framework-free.
{
  const dir = join(__dirname, "..", "lib", "backtest");
  for (const file of readdirSync(dir)) {
    const text = readFileSync(join(dir, file), "utf8");
    assert.ok(!/from\s+["']react/.test(text) && !/from\s+["']next/.test(text), `${file} imports a UI framework`);
  }
  checks += 1;
}

async function main() {
  const rng = mulberry32(7);
  const data = makeMinutes(rng, 3);

  // Forming-candle merge equals the server aggregate once each bucket closes.
  for (const tf of ["5m", "15m", "1h", "4h"] as Timeframe[]) {
    assert.deepEqual(aggregateMinutes(data, tf), serverAggregate(data, tf), `aggregateMinutes ${tf}`);
    const { engine, clock, mirror } = engineFor(data, { timeframe: tf, startMs: BASE, maxCandles: 100_000, historyBars: 5000 });
    await engine.load();
    engine.setSpeed(100);
    engine.play();
    while (engine.getState().status !== "ended") await clock.advance(1000);
    assert.deepEqual(engine.candles(), serverAggregate(data, tf), `played ${tf} equals server`);
    assert.deepEqual(mirror.candles, engine.candles());
    checks += 1;
  }

  // Timeframe switch mid-bucket: partial candle correct, no leak, no duplicates.
  {
    const { engine, mirror } = engineFor(data);
    await engine.load();
    const hour = BASE + 30 * 60 * MINUTE_MS;
    await engine.seek(hour + 37 * MINUTE_MS);
    for (let i = 0; i < 13; i += 1) await engine.stepMinute();
    assertMatchesServer(engine, data, mirror, "before switch");
    for (const tf of ["1h", "1m", "15m", "4h", "5m", "1d"] as Timeframe[]) {
      const cursor = engine.getState().cursorMs;
      await engine.setTimeframe(tf);
      assert.equal(engine.getState().cursorMs, cursor, "switch keeps the cursor");
      assertMatchesServer(engine, data, mirror, `switch to ${tf}`);
      await engine.stepMinute();
      assertMatchesServer(engine, data, mirror, `step after ${tf}`);
    }
    checks += 1;
  }

  // Step back and seek rebuild the same state as playing forward.
  {
    const forward = engineFor(data);
    await forward.engine.load();
    for (let i = 0; i < 97; i += 1) await forward.engine.stepMinute();
    await forward.engine.stepCandle();
    const target = forward.engine.getState().cursorMs;
    const seeker = engineFor(data);
    await seeker.engine.load();
    await seeker.engine.seek(target);
    const tail = (candles: Candle[], n: number) => candles.slice(-n);
    const seekCandles = seeker.engine.candles();
    assert.deepEqual(seekCandles, tail(forward.engine.candles(), seekCandles.length), "seek equals play forward");
    assert.equal(seeker.engine.getState().cursorMs, target);
    await forward.engine.stepBack("minute");
    const back = engineFor(data);
    await back.engine.load();
    await back.engine.seek(target - MINUTE_MS);
    assert.deepEqual(forward.engine.candles(), back.engine.candles(), "step back equals seek");
    assertMatchesServer(forward.engine, data, forward.mirror, "after step back");
    await forward.engine.stepBack("candle");
    assert.equal(forward.engine.getState().cursorMs % timeframeMs("5m"), 0, "candle step back lands on a bucket start");
    assertMatchesServer(forward.engine, data, forward.mirror, "after candle step back");
    checks += 1;
  }

  // Buffer starvation pauses and resumes on its own.
  {
    const server = new FakeServer(data);
    const pending: Array<() => void> = [];
    let hold = false;
    const source: CandleSource = {
      history: (tf, cutoff, bars) => server.history(tf, cutoff, bars),
      minutes: (from, to) => {
        if (!hold) return server.minutes(from, to);
        return new Promise((resolve) => pending.push(() => resolve(server.minutes(from, to))));
      },
    };
    const clock = new FakeClock();
    const engine = new ReplayEngine({
      source,
      clock,
      timeframe: "1m",
      startMs: BASE + 600 * MINUTE_MS,
      minMs: BASE,
      endMs: BASE + 3 * DAY,
      chunkMinutes: 100,
      prefetchThreshold: 20,
    });
    const statuses: string[] = [];
    engine.subscribe((e) => {
      if (e.type === "state" && statuses[statuses.length - 1] !== e.state.status) statuses.push(e.state.status);
    });
    await engine.load();
    hold = true;
    await settle();
    engine.setSpeed(100);
    engine.play();
    await clock.advance(5000);
    assert.equal(engine.getState().status, "buffering", "an empty buffer pauses playback");
    const stalledAt = engine.getState().cursorMs;
    await clock.advance(3000);
    assert.equal(engine.getState().cursorMs, stalledAt, "no time passes while buffering");
    hold = false;
    while (pending.length) pending.shift()!();
    await settle();
    assert.equal(engine.getState().status, "playing", "playback resumes when data arrives");
    await clock.advance(2000);
    assert.ok(engine.getState().cursorMs > stalledAt);
    assert.ok(statuses.includes("buffering") && statuses.lastIndexOf("playing") > statuses.indexOf("buffering"));
    engine.destroy();
    checks += 1;
  }

  // Throttled tab: catch-up happens in bounded batches, never a 60 s burst.
  {
    const { engine, clock, mirror } = engineFor(data, { timeframe: "1m", chunkMinutes: 2000, prefetchThreshold: 500 });
    await engine.load();
    engine.setSpeed(100);
    engine.play();
    await clock.advance(1000);
    const perTick = () => mirror.minutes.map((batch) => batch.length);
    assert.ok(perTick().every((n) => n <= 50));
    const before = engine.getState().cursorMs;
    const batchesBefore = mirror.minutes.length;
    await clock.stall(60_000);
    const lateBatch = mirror.minutes.slice(batchesBefore);
    assert.equal(lateBatch.length, 1);
    assert.ok(lateBatch[0].length <= 50, "a late tick processes at most one batch");
    await clock.advance(500);
    const caughtUp = mirror.minutes.slice(batchesBefore).reduce((sum, batch) => sum + batch.length, 0);
    assert.ok(caughtUp <= 200 + 100, `backlog is capped (consumed ${caughtUp})`);
    assert.ok(engine.getState().cursorMs > before);
    assertMatchesServer(engine, data, mirror, "after throttle");
    engine.destroy();
    checks += 1;
  }

  // End of data, rewind guard, error and retry.
  {
    const { engine, clock, mirror, server } = engineFor(data);
    await engine.load();
    await engine.seek(engine.endMs - 30 * MINUTE_MS);
    engine.setSpeed(100);
    engine.play();
    await clock.advance(3000);
    assert.equal(engine.getState().status, "ended");
    assertMatchesServer(engine, data, mirror, "at end");
    assert.equal(await engine.stepMinute(), false);

    let allow = false;
    const guarded = engineFor(data, { canRewind: () => allow });
    await guarded.engine.load();
    await guarded.engine.stepCandle();
    const at = guarded.engine.getState().cursorMs;
    assert.equal(await guarded.engine.stepBack("minute"), false);
    assert.equal(guarded.engine.getState().cursorMs, at, "rewind refused while guarded");
    assert.equal(await guarded.engine.seek(at + 10 * MINUTE_MS), true, "forward seek still allowed");
    allow = true;
    assert.equal(await guarded.engine.reset(), true);
    assert.equal(guarded.engine.getState().cursorMs, guarded.engine.startMs);

    server.failNext = 1;
    await engine.seek(BASE + 900 * MINUTE_MS);
    assert.equal(engine.getState().status, "error");
    assert.equal(engine.getState().error, "network down");
    await engine.retry();
    assert.equal(engine.getState().status, "paused");
    assertMatchesServer(engine, data, mirror, "after retry");
    checks += 1;
  }

  // Property: random play, pause, seek, step and timeframe-switch sequences never leak, skip or duplicate.
  const seed = seedFrom(process.env.BT_SEED, 20261014);
  const sequences = process.env.BT_SEED ? 1 : 500;
  for (let s = 0; s < sequences; s += 1) {
    const sequenceSeed = (seed + s) >>> 0;
    const r = mulberry32(sequenceSeed);
    const dataset = makeMinutes(r, 2);
    const startMs = BASE + randomInt(r, 0, 2 * 1440 - 1) * MINUTE_MS;
    const { engine, clock, mirror } = engineFor(dataset, {
      timeframe: pick(r, TIMEFRAMES),
      startMs,
      chunkMinutes: randomInt(r, 30, 400),
      prefetchThreshold: randomInt(r, 5, 80),
      historyBars: 120,
    });
    const ops: string[] = [];
    try {
      await engine.load();
      for (let step = 0; step < 14; step += 1) {
        const op = randomInt(r, 0, 8);
        if (op === 0) {
          engine.play();
          const ms = randomInt(r, 50, 2500);
          ops.push(`play+${ms}`);
          await clock.advance(ms);
        } else if (op === 1) {
          ops.push("pause");
          engine.pause();
        } else if (op === 2) {
          const t = BASE + randomInt(r, 0, 2 * 1440) * MINUTE_MS;
          ops.push(`seek ${t}`);
          await engine.seek(t);
        } else if (op === 3) {
          const tf = pick(r, TIMEFRAMES);
          ops.push(`tf ${tf}`);
          await engine.setTimeframe(tf);
        } else if (op === 4) {
          ops.push("stepMinute");
          await engine.stepMinute();
        } else if (op === 5) {
          ops.push("stepCandle");
          await engine.stepCandle();
        } else if (op === 6) {
          const unit = r() < 0.5 ? "minute" : "candle";
          ops.push(`back ${unit}`);
          await engine.stepBack(unit);
        } else if (op === 7) {
          const speed = pick<ReplaySpeed>(r, [1, 2, 5, 10, 20, 50, 100, "candle"]);
          ops.push(`speed ${speed}`);
          engine.setSpeed(speed);
        } else {
          ops.push("reset");
          await engine.reset();
        }
        await settle();
        assertMatchesServer(engine, dataset, mirror, `op ${step}`);
      }
      engine.destroy();
    } catch (error) {
      console.error(`replay property failed: BT_SEED=${sequenceSeed} ops=${ops.join(", ")}`);
      throw error;
    }
  }
  checks += 1;
  console.log(`replay engine checks passed (${checks} groups, ${sequences} property sequences, seed ${seed})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
