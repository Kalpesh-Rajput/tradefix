import type { BarLike } from "./types";

const FALLBACK_STEP_MS = 60_000;

/** Typical bar spacing, robust against weekend gaps. */
export function barStep(bars: readonly BarLike[]): number {
  if (bars.length < 2) return FALLBACK_STEP_MS;
  const diffs: number[] = [];
  for (let i = Math.max(1, bars.length - 25); i < bars.length; i += 1) {
    const diff = bars[i].time - bars[i - 1].time;
    if (diff > 0) diffs.push(diff);
  }
  if (!diffs.length) return FALLBACK_STEP_MS;
  diffs.sort((a, b) => a - b);
  return diffs[diffs.length >> 1];
}

function lowerIndex(bars: readonly BarLike[], time: number): number {
  let lo = 0;
  let hi = bars.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (bars[mid].time <= time) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

/**
 * Chart time (ms) to fractional bar index. Times between bars interpolate; times beyond either end extrapolate
 * by the typical bar step, so drawings may sit in the future or the past without a candle underneath.
 */
export function timeToLogical(bars: readonly BarLike[], time: number): number | null {
  const n = bars.length;
  if (!n) return null;
  const step = barStep(bars);
  if (time < bars[0].time) return (time - bars[0].time) / step;
  const i = lowerIndex(bars, time);
  if (i >= n - 1) return n - 1 + (time - bars[n - 1].time) / step;
  const span = bars[i + 1].time - bars[i].time;
  return i + (time - bars[i].time) / span;
}

export function logicalToTime(bars: readonly BarLike[], logical: number): number | null {
  const n = bars.length;
  if (!n) return null;
  const step = barStep(bars);
  if (logical < 0) return Math.round(bars[0].time + logical * step);
  if (logical >= n - 1) return Math.round(bars[n - 1].time + (logical - (n - 1)) * step);
  const i = Math.floor(logical);
  return Math.round(bars[i].time + (logical - i) * (bars[i + 1].time - bars[i].time));
}

/** Bars whose open time lies within [from, to]. */
export function barsBetween(bars: readonly BarLike[], from: number, to: number): BarLike[] {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  const first = lowerIndex(bars, lo - 1) + 1;
  const out: BarLike[] = [];
  for (let i = first; i < bars.length && bars[i].time <= hi; i += 1) out.push(bars[i]);
  return out;
}
