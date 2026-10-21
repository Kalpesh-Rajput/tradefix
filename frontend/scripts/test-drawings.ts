/**
 * Drawing engine: geometry, calculations, store, controller and persistence mapping.
 * Run: npx --yes tsx scripts/test-drawings.ts
 */
import assert from "node:assert/strict";

import { ChartModel, attachChart, type ChartBackend, type ChartDisplay } from "../components/chart/chartModel";
import type { ChartTheme } from "../components/chart/chartTheme";
import { DrawingController } from "../components/chart/drawings/controller";
import { hitShapes } from "../components/chart/drawings/hit";
import { expandPosition, fibPrices, measure, normalizePosition, positionMetrics, roundPrice } from "../components/chart/drawings/metrics";
import { buildShapes } from "../components/chart/drawings/shapes";
import { DrawingStore } from "../components/chart/drawings/store";
import type { DrawingSurface } from "../components/chart/drawings/surface";
import { barStep, barsBetween, logicalToTime, timeToLogical } from "../components/chart/drawings/timeMapper";
import { defaultFibLevels, defaultProps, defaultStyle } from "../components/chart/drawings/tools";
import { SCHEMA_VERSION, type Drawing, type DrawingContext, type ToolId } from "../components/chart/drawings/types";
import { makeView } from "../components/chart/drawings/view";
import { fromDto, toDto } from "../lib/chartDrawings";
import { planToOrder } from "../lib/backtest/positionPlan";

const THEME: ChartTheme = {
  mode: "light", background: "#fff", text: "#888", grid: "#eee", border: "#ddd", crosshair: "#888",
  crosshairLabel: "#444", up: "#0a0", down: "#a00", accent: "#44f", fontFamily: "Inter",
};
const CTX: DrawingContext = { priceDecimals: 2, pipSize: 0.01, contractSize: 1, quoteCurrency: "USD", accountCurrency: "USD" };
const T0 = 1_700_000_000_000;
const STEP = 60_000;

let bars = Array.from({ length: 100 }, (_, i) => ({ time: T0 + i * STEP, volume: 10 }));

/** Linear fake chart: x = 10 per bar, y = 1000 - 5 * price. */
function fakeSurface(): DrawingSurface & { repaints: number } {
  return {
    repaints: 0,
    container: {} as HTMLElement,
    plotSize: () => ({ width: 1000, height: 1000 }),
    logicalToX: (l) => l * 10,
    xToLogical: (x) => x / 10,
    priceToY: (p) => 1000 - p * 5,
    yToPrice: (y) => (1000 - y) / 5,
    bars: () => bars,
    theme: () => THEME,
    attachPainter() {
      return { requestRepaint() {}, detach() {} };
    },
  };
}

function setup() {
  const surface = fakeSurface();
  let id = 0;
  const store = new DrawingStore(() => `d${++id}`);
  const controller = new DrawingController(surface, store, () => CTX, () => ({ symbol: "EURUSD", source: null, timeframe: "1m" }));
  const px = (bar: number, price: number) => ({ x: bar * 10, y: 1000 - price * 5 });
  return { surface, store, controller, px };
}

function draw(controller: DrawingController, store: DrawingStore, tool: ToolId, points: { x: number; y: number }[]) {
  store.setTool(tool);
  for (const point of points) {
    controller.pointerDown(point);
    controller.pointerUp(point);
  }
}

const drawing = (tool: ToolId, anchors: { t: number; p: number }[], over: Partial<Drawing> = {}): Drawing => ({
  id: "x",
  tool,
  symbol: "EURUSD",
  source: null,
  timeframe: "1m",
  anchors,
  style: defaultStyle(tool, "#44f"),
  props: defaultProps(tool),
  visible: true,
  locked: false,
  z: 1,
  schemaVersion: SCHEMA_VERSION,
  ...over,
});

// --- time mapper: stable under data changes, extrapolates past either end
assert.equal(barStep(bars), STEP);
assert.equal(timeToLogical(bars, T0 + 5 * STEP), 5);
assert.equal(timeToLogical(bars, T0 + 5.5 * STEP), 5.5);
assert.equal(timeToLogical(bars, T0 + 120 * STEP), 120, "future time extrapolates");
assert.equal(timeToLogical(bars, T0 - 3 * STEP), -3, "past time extrapolates");
assert.equal(logicalToTime(bars, 5.5), T0 + 5.5 * STEP);
assert.equal(logicalToTime(bars, 120), T0 + 120 * STEP);
assert.equal(timeToLogical([], T0), null);
assert.equal(barsBetween(bars, T0 + 2 * STEP, T0 + 4 * STEP).length, 3);
const gapped = [{ time: 0 }, { time: STEP }, { time: 2 * STEP }, { time: 10 * STEP }, { time: 11 * STEP }];
assert.equal(timeToLogical(gapped, 6 * STEP), 2.5, "weekend gap interpolates between bars");
assert.equal(barStep(gapped), STEP, "gaps do not distort the bar step");
const grown = [...bars, { time: T0 + 100 * STEP, volume: 10 }];
assert.equal(timeToLogical(grown, T0 + 100 * STEP), timeToLogical(bars, T0 + 100 * STEP), "new candle does not shift an anchored time");

// --- fibonacci
{
  const levels = defaultFibLevels("fib_retracement");
  assert.deepEqual(levels.filter((l) => l.enabled).map((l) => l.value), [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]);
  assert.deepEqual(levels.filter((l) => !l.enabled).map((l) => l.value), [1.272, 1.618]);
  const up = drawing("fib_retracement", [{ t: T0, p: 100 }, { t: T0 + STEP, p: 200 }]);
  const upPrices = Object.fromEntries(fibPrices(up, CTX).map((r) => [r.level.value, r.price]));
  assert.equal(upPrices[0], 200);
  assert.equal(upPrices[0.5], 150);
  assert.equal(upPrices[0.618], 138.2);
  assert.equal(upPrices[1], 100);
  const down = drawing("fib_retracement", [{ t: T0, p: 200 }, { t: T0 + STEP, p: 100 }]);
  const downPrices = Object.fromEntries(fibPrices(down, CTX).map((r) => [r.level.value, r.price]));
  assert.equal(downPrices[0], 100);
  assert.equal(downPrices[0.618], 161.8);
  assert.equal(downPrices[1], 200);
  const extended = drawing("fib_retracement", up.anchors, {
    props: { levels: defaultFibLevels("fib_retracement").map((l) => ({ ...l, enabled: l.value === 1.618 || l.value === 1.272 })) },
  });
  assert.deepEqual(fibPrices(extended, CTX).map((r) => r.price), [72.8, 38.2], "extension levels continue past the start");
  assert.equal(fibPrices(extended, CTX)[1].price, roundPrice(200 - 100 * 1.618, 2));
  const disabled = drawing("fib_retracement", up.anchors, { props: { levels: [{ value: 0.5, label: "half", enabled: false }] } });
  assert.equal(fibPrices(disabled, CTX).length, 0, "disabled levels are not drawn");
  const renamed = drawing("fib_retracement", up.anchors, { props: { levels: [{ value: 0.5, label: "mid", enabled: true }] } });
  assert.equal(fibPrices(renamed, CTX)[0].level.label, "mid");
  const fx = fibPrices(drawing("fib_retracement", [{ t: T0, p: 1.0 }, { t: T0 + STEP, p: 1.1 }]), { priceDecimals: 5 });
  assert.equal(fx.find((r) => r.level.value === 0.618)!.price, 1.03820, "respects instrument precision");
  const ext = drawing("fib_extension", [{ t: T0, p: 100 }, { t: T0 + STEP, p: 110 }, { t: T0 + 2 * STEP, p: 105 }]);
  assert.equal(fibPrices(ext, CTX).find((r) => r.level.value === 1)!.price, 115);
  assert.equal(fibPrices(drawing("fib_extension", ext.anchors.slice(0, 2)), CTX).length, 0);
}

// --- position planning: the worked example from the spec
{
  const long = drawing("long_position", [{ t: T0, p: 100 }, { t: T0 + 10 * STEP, p: 95 }, { t: T0 + 10 * STEP, p: 110 }], { props: { qty: 2 } });
  const m = positionMetrics(long, bars, CTX)!;
  assert.equal(m.risk, 5);
  assert.equal(m.reward, 10);
  assert.equal(m.ratio, 2);
  assert.equal(m.riskPercent, 5);
  assert.equal(m.rewardPercent, 10);
  assert.equal(m.riskTicks, 500);
  assert.equal(m.riskPnl, -10);
  assert.equal(m.rewardPnl, 20);
  assert.equal(m.bars, 10);
  const short = drawing("short_position", [{ t: T0, p: 100 }, { t: T0 + STEP, p: 104 }, { t: T0 + STEP, p: 92 }], { props: { qty: 1 } });
  const s = positionMetrics(short, bars, CTX)!;
  assert.equal(s.risk, 4);
  assert.equal(s.reward, 8);
  assert.equal(s.ratio, 2);
  const unknown = positionMetrics(long, bars, { priceDecimals: 2 })!;
  assert.equal(unknown.rewardPnl, null, "no P&L without instrument size");
  const foreign = positionMetrics(long, bars, { ...CTX, quoteCurrency: "JPY" })!;
  assert.equal(foreign.rewardPnl, null, "no P&L across currencies without conversion");
  const inverted = drawing("long_position", [{ t: T0, p: 100 }, { t: T0 + STEP, p: 105 }, { t: T0 + STEP, p: 90 }]);
  const fixed = normalizePosition(inverted, CTX);
  assert.ok(fixed[1].p < 100 && fixed[2].p > 100, "stop and target are kept on their sides of entry");
  const expanded = expandPosition(drawing("long_position", [{ t: T0, p: 100 }, { t: T0 + 5 * STEP, p: 110 }]), CTX);
  assert.deepEqual(expanded.map((a) => a.p), [100, 90, 110]);
  const noRisk = drawing("long_position", [{ t: T0, p: 100 }, { t: T0 + STEP, p: 100 }, { t: T0 + STEP, p: 110 }]);
  assert.equal(positionMetrics(noRisk, bars, CTX)!.ratio, null, "zero risk has no ratio");
}

// --- measurements use data, not pixels
{
  const m = measure({ t: T0 + 10 * STEP, p: 100 }, { t: T0 + 20 * STEP, p: 110 }, bars, CTX);
  assert.equal(m.priceDiff, 10);
  assert.equal(m.percent, 10);
  assert.equal(m.bars, 10);
  assert.equal(m.elapsedMs, 10 * STEP);
  assert.equal(m.volume, 110);
  assert.equal(m.pips, 1000);
  assert.equal(measure({ t: T0, p: 0 }, { t: T0 + STEP, p: 1 }, bars, CTX).percent, null);
  assert.equal(measure({ t: T0 + 500 * STEP, p: 1 }, { t: T0 + 600 * STEP, p: 2 }, bars, CTX).volume, null, "no volume outside loaded data");
}

// --- position to simulated order
{
  const plan = { side: "long" as const, entry: 100, stop: 95, target: 110, qty: 0.5 };
  assert.deepEqual(planToOrder(plan, 100, 0.01), { ok: true, order: { side: "buy", kind: "market", size: 0.5, price: null, sl: 95, tp: 110 } });
  assert.equal((planToOrder(plan, 103, 0.01) as { order: { kind: string } }).order.kind, "limit");
  assert.equal((planToOrder(plan, 97, 0.01) as { order: { kind: string } }).order.kind, "stop");
  const short = { side: "short" as const, entry: 100, stop: 105, target: 90, qty: 1 };
  assert.equal((planToOrder(short, 97, 0.01) as { order: { kind: string } }).order.kind, "limit");
  assert.equal(planToOrder({ ...plan, qty: 0 }, 100, 0.01).ok, false);
  assert.equal(planToOrder(plan, null, 0.01).ok, false);
  assert.equal(planToOrder({ ...plan, stop: 101 }, 100, 0.01).ok, false);
}

// --- store: undo, redo, dirty tracking, drags
{
  const store = new DrawingStore(() => "n");
  store.add(drawing("trendline", [{ t: T0, p: 1 }, { t: T0 + STEP, p: 2 }], { id: "a" }));
  store.add(drawing("rectangle", [{ t: T0, p: 1 }, { t: T0 + STEP, p: 2 }], { id: "b" }));
  assert.equal(store.drawings.length, 2);
  assert.deepEqual(store.takeDirty().upserts.map((d) => d.id).sort(), ["a", "b"]);
  store.undo();
  assert.equal(store.drawings.length, 1);
  assert.deepEqual(store.takeDirty().deletes, ["b"]);
  store.redo();
  assert.equal(store.drawings.length, 2);
  assert.equal(store.canRedo, false);
  store.takeDirty();
  store.beginDrag();
  for (let i = 0; i < 50; i += 1) store.dragTo("a", { anchors: [{ t: T0 + i, p: 1 }, { t: T0 + STEP, p: 2 }] });
  assert.equal(store.canUndo, true);
  store.endDrag();
  assert.equal(store.takeDirty().upserts.length, 1, "a drag is one change");
  store.undo();
  assert.equal(store.drawings[0].anchors[0].t, T0, "one undo reverts a whole drag");
  store.cancelDrag();
  const batch = store.takeDirty();
  store.restoreDirty({ upserts: batch.upserts, deletes: [] });
  store.remove("b");
  assert.ok(store.hasDirty());
  store.hydrate([drawing("trendline", [], { id: "z" })]);
  assert.equal(store.hasDirty(), false, "hydrate is not a user change");
  assert.equal(store.canUndo, false);
  const copy = store.duplicate("z", { t: 5, p: 1 });
  assert.notEqual(copy!.id, "z");
  store.clear();
  assert.equal(store.drawings.length, 0);
  store.undo();
  assert.equal(store.drawings.length, 2);
}

// --- controller: create, select, move, resize, delete
{
  const { store, controller, px } = setup();
  draw(controller, store, "trendline", [px(10, 100), px(30, 120)]);
  assert.equal(store.drawings.length, 1);
  const line = store.drawings[0];
  assert.equal(line.tool, "trendline");
  assert.deepEqual(line.anchors, [{ t: T0 + 10 * STEP, p: 100 }, { t: T0 + 30 * STEP, p: 120 }]);
  assert.equal(store.activeTool, null, "tool reverts after placement");
  assert.equal(line.symbol, "EURUSD");

  store.select(null);
  assert.equal(controller.pointerDown(px(20, 110)), true, "click on the line selects it");
  assert.equal(store.selectedId, line.id);
  controller.pointerMove(px(20, 130));
  controller.pointerUp(px(20, 130));
  const moved = store.drawings[0].anchors;
  assert.equal(moved[0].p, 120, "body drag moves both anchors");
  assert.equal(moved[1].p, 140);
  assert.equal(moved[0].t, T0 + 10 * STEP);

  controller.pointerDown(px(10, 120));
  controller.pointerMove(px(5, 125));
  controller.pointerUp(px(5, 125));
  assert.deepEqual(store.drawings[0].anchors[0], { t: T0 + 5 * STEP, p: 125 }, "handle drag resizes one anchor");
  assert.equal(store.drawings[0].anchors[1].p, 140);

  store.undo();
  assert.equal(store.drawings[0].anchors[0].t, T0 + 10 * STEP);
  assert.equal(controller.deleteSelected(), true);
  assert.equal(store.drawings.length, 0);

  assert.equal(controller.pointerDown({ x: 500, y: 500 }), false, "empty space is left to chart panning");
}

// --- controller: one-point and multi-point tools, drag-to-draw, escape
{
  const { store, controller, px } = setup();
  draw(controller, store, "horizontal_line", [px(40, 100)]);
  draw(controller, store, "vertical_line", [px(40, 100)]);
  draw(controller, store, "rectangle", [px(10, 90), px(20, 110)]);
  draw(controller, store, "parallel_channel", [px(10, 90), px(30, 100), px(20, 110)]);
  draw(controller, store, "text", [px(50, 100)]);
  draw(controller, store, "fib_retracement", [px(10, 90), px(30, 130)]);
  assert.deepEqual(store.drawings.map((d) => d.tool), ["horizontal_line", "vertical_line", "rectangle", "parallel_channel", "text", "fib_retracement"]);
  assert.equal(store.drawings[3].anchors.length, 3);
  assert.equal(store.drawings[4].props.text, "Text");

  store.setTool("trendline");
  controller.pointerDown(px(10, 100));
  controller.pointerMove(px(40, 150));
  assert.equal(store.draft!.anchors.length, 2, "preview follows the pointer");
  controller.pointerUp(px(40, 150));
  assert.equal(store.drawings.length, 7, "press, drag and release draws a two-point tool");

  store.setTool("trendline");
  controller.pointerDown(px(10, 100));
  controller.pointerUp(px(10, 100));
  assert.ok(store.draft);
  assert.equal(controller.cancel(), true);
  assert.equal(store.draft, null, "Escape cancels an unfinished drawing");
  assert.equal(store.activeTool, null);
  assert.equal(store.drawings.length, 7);

  draw(controller, store, "long_position", [px(60, 100), px(75, 110)]);
  const position = store.drawings.at(-1)!;
  assert.equal(position.anchors.length, 3);
  assert.deepEqual(position.anchors.map((a) => a.p), [100, 90, 110]);
  controller.pointerDown(px(75, 110));
  controller.pointerMove(px(75, 130));
  controller.pointerUp(px(75, 130));
  assert.equal(store.drawings.at(-1)!.anchors[2].p, 130, "target handle moves");
  assert.equal(store.drawings.at(-1)!.anchors[1].t, store.drawings.at(-1)!.anchors[2].t, "stop and target share a right edge");
}

// --- locked and hidden drawings do not move
{
  const { store, controller, px } = setup();
  draw(controller, store, "trendline", [px(10, 100), px(30, 120)]);
  const id = store.drawings[0].id;
  store.patch(id, { locked: true });
  store.select(null);
  controller.pointerDown(px(20, 110));
  controller.pointerMove(px(20, 150));
  controller.pointerUp(px(20, 150));
  assert.equal(store.drawings[0].anchors[0].p, 100, "locked drawing stays put");
  assert.equal(controller.deleteSelected(), false, "locked drawing cannot be deleted");
  store.patch(id, { locked: false, visible: false });
  store.select(null);
  assert.equal(controller.pointerDown(px(20, 110)), false, "hidden drawing is not hit");
  store.patch(id, { visible: true });
  store.setHiddenAll(true);
  assert.equal(controller.paintList().length, 0);
  assert.equal(controller.pointerDown(px(20, 110)), false);
}

// --- alignment: pixels follow the chart, anchors stay in time and price
{
  const { surface, store, controller, px } = setup();
  draw(controller, store, "trendline", [px(10, 100), px(30, 120)]);
  const before = store.drawings[0].anchors;
  const view = (s: DrawingSurface) => makeView(s, CTX).point(before[0])!;
  assert.deepEqual(view(surface), { x: 100, y: 500 });
  const zoomed: DrawingSurface = { ...surface, logicalToX: (l) => l * 20, xToLogical: (x) => x / 20, priceToY: (p) => 800 - p * 4, yToPrice: (y) => (800 - y) / 4 };
  assert.deepEqual(view(zoomed), { x: 200, y: 400 }, "same anchor, new scale");
  bars = bars.slice(5);
  assert.equal(timeToLogical(bars, before[0].t), 5, "anchor follows its candle when earlier history is trimmed");
  bars = Array.from({ length: 100 }, (_, i) => ({ time: T0 + i * STEP, volume: 10 }));
  const shapes = buildShapes(store.drawings[0], makeView(surface, CTX)).shapes;
  assert.ok(hitShapes(shapes, px(20, 110)));
  assert.ok(!hitShapes(shapes, px(20, 140)));
}

// --- persistence mapping
{
  const original = drawing("fib_retracement", [{ t: T0, p: 1.23456 }, { t: T0 + STEP, p: 1.3 }], { id: "7b1c2e0a-0000-4000-8000-000000000001" });
  const restored = fromDto(toDto(original))!;
  assert.deepEqual(restored.anchors, original.anchors);
  assert.deepEqual(restored.props.levels, original.props.levels);
  assert.equal(restored.locked, false);
  assert.equal(fromDto({ ...toDto(original), tool: "gann_fan" }), null, "unknown tools are skipped, not crashed on");
  assert.equal(fromDto({ ...toDto(original), schema_version: 99 }), null, "newer schema is left alone");
  assert.equal(fromDto({ ...toDto(original), style: {} })!.style.width, 2, "missing style falls back");
}

// --- lifecycle: repeated mounts release the drawing layer every time
{
  let attached = 0;
  let released = 0;
  const display: ChartDisplay = { theme: THEME, timeZone: "UTC", priceDecimals: 2, showVolume: false };
  const backend = (): ChartBackend => ({
    setBars() {}, updateBar() {}, setMarkers() {},
    addPriceLine: () => ({ update() {}, remove() {} }),
    centerOn() {}, fit() {}, setDisplay() {}, resize() {},
    onCrosshair: () => () => {}, timeToX: () => null, onRange: () => () => {},
    surface: () => fakeSurface(),
    remove() {},
  });
  const model = new ChartModel(display);
  model.setSurfaceClient(() => {
    attached += 1;
    return () => {
      released += 1;
    };
  });
  for (let i = 0; i < 25; i += 1) {
    const detach = attachChart({
      container: {} as HTMLElement,
      model,
      createBackend: backend,
      readTheme: () => THEME,
      observeResize: () => () => {},
      subscribeTheme: () => () => {},
    });
    detach();
    detach();
  }
  assert.equal(attached, 25);
  assert.equal(released, 25, "every mount's drawing layer is released exactly once");
  model.setSurfaceClient(null);
}

console.log("drawings: all checks passed");
