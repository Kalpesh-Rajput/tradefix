/**
 * CandleChart lifecycle and model rules, against a fake chart backend.
 * Run: npx --yes tsx scripts/test-chart-lifecycle.ts
 */
import assert from "node:assert/strict";

import {
  ChartModel,
  attachChart,
  indexAtOrBefore,
  type CandleBar,
  type ChartBackend,
  type ChartDisplay,
  type ChartPriceLine,
} from "../components/chart/chartModel";
import type { ChartTheme } from "../components/chart/chartTheme";
import { formatTickMark, safeTimeZone, timeZoneLabel } from "../components/chart/chartTime";

const THEME: ChartTheme = {
  mode: "light",
  background: "#fff",
  text: "#888",
  grid: "#eee",
  border: "#ddd",
  crosshair: "#888",
  crosshairLabel: "#444",
  up: "#0a0",
  down: "#a00",
  accent: "#44f",
  fontFamily: "Inter",
};
const DARK: ChartTheme = { ...THEME, mode: "dark", background: "#111" };
const DISPLAY: ChartDisplay = { theme: THEME, timeZone: "UTC", priceDecimals: 2, showVolume: false };

type FakeBackend = ChartBackend & {
  bars: CandleBar[];
  setBarsCalls: number;
  updates: number;
  lines: Map<string, ChartPriceLine>;
  display: ChartDisplay | null;
  centered: number | null;
  removed: boolean;
  crosshairSubscribers: number;
};

function makeFactory() {
  const created: FakeBackend[] = [];
  let lineSeq = 0;
  const factory = (_container: HTMLElement, display: ChartDisplay): FakeBackend => {
    const backend: FakeBackend = {
      bars: [],
      setBarsCalls: 0,
      updates: 0,
      lines: new Map(),
      display,
      centered: null,
      removed: false,
      crosshairSubscribers: 0,
      setBars(bars) {
        assert.ok(!this.removed, "setBars after remove");
        this.bars = [...bars];
        this.setBarsCalls += 1;
      },
      updateBar(bar) {
        assert.ok(!this.removed, "updateBar after remove");
        const last = this.bars[this.bars.length - 1];
        if (last && last.time === bar.time) this.bars[this.bars.length - 1] = bar;
        else this.bars.push(bar);
        this.updates += 1;
      },
      setMarkers() {},
      addPriceLine(line) {
        assert.ok(!this.removed, "addPriceLine after remove");
        const key = `${line.id}#${++lineSeq}`;
        this.lines.set(key, line);
        return {
          update: (next) => {
            this.lines.set(key, next);
          },
          remove: () => {
            this.lines.delete(key);
          },
        };
      },
      centerOn(index) {
        this.centered = index;
      },
      fit() {},
      setDisplay(next) {
        this.display = next;
      },
      resize() {},
      timeToX() {
        return null;
      },
      onRange() {
        return () => {};
      },
      onCrosshair() {
        this.crosshairSubscribers += 1;
        return () => {
          this.crosshairSubscribers -= 1;
        };
      },
      remove() {
        assert.ok(!this.removed, "remove called twice");
        this.removed = true;
      },
    };
    created.push(backend);
    return backend;
  };
  return { factory, created };
}

function makeEnv(model: ChartModel) {
  const { factory, created } = makeFactory();
  const counters = { resizeActive: 0, themeActive: 0 };
  let themeListener: (() => void) | null = null;
  let currentTheme = THEME;
  const env = {
    container: {} as HTMLElement,
    model,
    createBackend: factory,
    readTheme: () => currentTheme,
    observeResize: () => {
      counters.resizeActive += 1;
      return () => {
        counters.resizeActive -= 1;
      };
    },
    subscribeTheme: (listener: () => void) => {
      counters.themeActive += 1;
      themeListener = listener;
      return () => {
        counters.themeActive -= 1;
        themeListener = null;
      };
    },
    onCrosshair: () => {},
  };
  const switchTheme = (next: ChartTheme) => {
    currentTheme = next;
    themeListener?.();
  };
  return { env, created, counters, switchTheme };
}

const bar = (minute: number, close = 100 + minute): CandleBar => ({
  time: minute * 60_000,
  open: close - 1,
  high: close + 1,
  low: close - 2,
  close,
});

// StrictMode: mount, unmount, mount gives balanced create/destroy and exactly one live chart.
{
  const model = new ChartModel(DISPLAY);
  const { env, created, counters } = makeEnv(model);
  const detachFirst = attachChart(env);
  detachFirst();
  const detachSecond = attachChart(env);
  assert.equal(created.length, 2);
  assert.equal(created.filter((b) => !b.removed).length, 1, "exactly one live chart after a double mount");
  assert.equal(counters.resizeActive, 1);
  assert.equal(counters.themeActive, 1);
  assert.equal(created[1].crosshairSubscribers, 1);
  detachSecond();
  detachSecond();
  assert.ok(created.every((b) => b.removed), "every chart created is removed");
  assert.equal(counters.resizeActive, 0, "resize observer disconnected");
  assert.equal(counters.themeActive, 0, "theme subscription removed");
  assert.equal(created[1].crosshairSubscribers, 0);
  assert.equal(model.bound, false);
}

// A remount restores bars and price lines without duplicating lines.
{
  const model = new ChartModel(DISPLAY);
  const { env, created } = makeEnv(model);
  const detach = attachChart(env);
  model.setHistory([bar(3), bar(1), bar(2), bar(2, 500)]);
  assert.deepEqual(created[0].bars.map((b) => b.time), [60_000, 120_000, 180_000]);
  assert.equal(created[0].bars[1].close, 500, "duplicate times keep the later bar");
  model.setPriceLine({ id: "entry", price: 101, color: "#000" });
  model.setPriceLine({ id: "entry", price: 102, color: "#000" });
  assert.equal(created[0].lines.size, 1, "upsert keeps a single line");
  detach();
  model.updateLast(bar(4));
  const again = attachChart(env);
  assert.equal(created[1].bars.length, 4, "state changed while unmounted is applied on remount");
  assert.equal(created[1].lines.size, 1);
  assert.equal([...created[1].lines.values()][0].price, 102);
  model.removePriceLine("entry");
  assert.equal(created[1].lines.size, 0);
  again();
}

// updateLast only touches the last candle and ignores stale bars.
{
  const model = new ChartModel(DISPLAY);
  const { env, created } = makeEnv(model);
  const detach = attachChart(env);
  model.setHistory([bar(1), bar(2)]);
  const setCalls = created[0].setBarsCalls;
  assert.equal(model.updateLast(bar(2, 900)), true);
  assert.equal(model.updateLast(bar(3)), true);
  assert.equal(model.updateLast(bar(1)), false);
  assert.equal(created[0].setBarsCalls, setCalls, "no full redraw per tick");
  assert.equal(created[0].updates, 2);
  assert.deepEqual(model.getBars().map((b) => b.close), [101, 900, 103]);
  detach();
}

// The bar cap trims old bars in batches, not on every tick.
{
  const model = new ChartModel(DISPLAY, 100);
  const { env, created } = makeEnv(model);
  const detach = attachChart(env);
  model.setHistory(Array.from({ length: 150 }, (_, i) => bar(i)));
  assert.equal(model.getBars().length, 100);
  assert.equal(model.getBars()[0].time, 50 * 60_000);
  const before = created[0].setBarsCalls;
  for (let m = 150; m < 160; m += 1) model.updateLast(bar(m));
  assert.equal(created[0].setBarsCalls, before, "within the slack no redraw happens");
  model.updateLast(bar(160));
  assert.equal(created[0].setBarsCalls, before + 1);
  assert.equal(model.getBars().length, 100);
  assert.equal(model.getBars()[99].time, 160 * 60_000);
  detach();
}

// Theme changes and display patches reach the live backend.
{
  const model = new ChartModel(DISPLAY);
  const { env, created, switchTheme } = makeEnv(model);
  const detach = attachChart(env);
  switchTheme(DARK);
  assert.equal(created[0].display?.theme.mode, "dark");
  model.setDisplay({ timeZone: "Asia/Kolkata", priceDecimals: 5 });
  assert.equal(created[0].display?.timeZone, "Asia/Kolkata");
  assert.equal(created[0].display?.theme.mode, "dark", "a display patch keeps the theme");
  detach();
  switchTheme(THEME);
  assert.equal(created[0].display?.theme.mode, "dark", "no theme updates after unmount");
}

// scrollTo centres the last bar at or before the time.
{
  const model = new ChartModel(DISPLAY);
  const { env, created } = makeEnv(model);
  const detach = attachChart(env);
  model.setHistory([bar(0), bar(5), bar(10)]);
  model.scrollTo(7 * 60_000);
  assert.equal(created[0].centered, 1);
  assert.equal(indexAtOrBefore(model.getBars(), -1), -1);
  detach();
}

// Time formatting respects the zone.
{
  const at = Date.UTC(2026, 1, 4, 10, 30);
  assert.equal(safeTimeZone("Not/AZone"), "UTC");
  assert.equal(safeTimeZone(undefined), "UTC");
  assert.equal(timeZoneLabel("UTC"), "UTC");
  assert.match(formatTickMark(at, 3, "UTC"), /10:30/);
  assert.match(formatTickMark(at, 3, "Asia/Kolkata"), /16:00/);
}

console.log("chart lifecycle checks passed");
