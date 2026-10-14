import type { ChartTheme } from "./chartTheme";

export type CandleBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type ChartMarker = {
  id: string;
  time: number;
  position: "aboveBar" | "belowBar" | "inBar";
  shape: "arrowUp" | "arrowDown" | "circle" | "square";
  color: string;
  text?: string;
};

export type ChartPriceLine = {
  id: string;
  price: number;
  color: string;
  title?: string;
  style?: "solid" | "dashed" | "dotted";
  width?: 1 | 2 | 3 | 4;
  axisLabel?: boolean;
};

export type ChartDisplay = {
  theme: ChartTheme;
  timeZone: string;
  priceDecimals: number;
  showVolume: boolean;
};

export interface PriceLineHandle {
  update(line: ChartPriceLine): void;
  remove(): void;
}

export interface ChartBackend {
  setBars(bars: readonly CandleBar[]): void;
  updateBar(bar: CandleBar): void;
  setMarkers(markers: readonly ChartMarker[]): void;
  addPriceLine(line: ChartPriceLine): PriceLineHandle;
  centerOn(index: number): void;
  fit(): void;
  setDisplay(display: ChartDisplay): void;
  resize(width: number, height: number): void;
  onCrosshair(handler: (bar: CandleBar | null) => void): () => void;
  remove(): void;
}

export type ChartBackendFactory = (container: HTMLElement, display: ChartDisplay) => ChartBackend;

export const DEFAULT_MAX_BARS = 20_000;

function normalizeBars(bars: readonly CandleBar[]): CandleBar[] {
  const sorted = [...bars].sort((a, b) => a.time - b.time);
  const out: CandleBar[] = [];
  for (const bar of sorted) {
    if (out.length && out[out.length - 1].time === bar.time) out[out.length - 1] = bar;
    else out.push(bar);
  }
  return out;
}

export function indexAtOrBefore(bars: readonly CandleBar[], time: number): number {
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

/** Chart state that outlives any single mounted chart, so a remount restores the same picture. */
export class ChartModel {
  private bars: CandleBar[] = [];
  private markers: ChartMarker[] = [];
  private lines = new Map<string, ChartPriceLine>();
  private handles = new Map<string, PriceLineHandle>();
  private backend: ChartBackend | null = null;
  private listeners = new Set<() => void>();
  private readonly trimSlack: number;

  constructor(
    public display: ChartDisplay,
    readonly maxBars = DEFAULT_MAX_BARS
  ) {
    this.trimSlack = Math.max(1, Math.floor(maxBars * 0.1));
  }

  get bound(): boolean {
    return this.backend !== null;
  }

  bind(backend: ChartBackend) {
    this.unbind();
    this.backend = backend;
    backend.setDisplay(this.display);
    backend.setBars(this.bars);
    backend.setMarkers(this.markers);
    for (const line of this.lines.values()) this.handles.set(line.id, backend.addPriceLine(line));
  }

  unbind() {
    this.handles.clear();
    this.backend = null;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }

  getBars(): readonly CandleBar[] {
    return this.bars;
  }

  lastBar(): CandleBar | null {
    return this.bars.length ? this.bars[this.bars.length - 1] : null;
  }

  setHistory(bars: readonly CandleBar[]) {
    this.bars = normalizeBars(bars).slice(-this.maxBars);
    this.backend?.setBars(this.bars);
    this.emit();
  }

  /** Returns false for a bar older than the last one; those are ignored. */
  updateLast(bar: CandleBar): boolean {
    const last = this.lastBar();
    if (last && bar.time < last.time) return false;
    if (last && bar.time === last.time) this.bars[this.bars.length - 1] = bar;
    else this.bars.push(bar);
    if (this.bars.length > this.maxBars + this.trimSlack) {
      this.bars = this.bars.slice(-this.maxBars);
      this.backend?.setBars(this.bars);
    } else {
      this.backend?.updateBar(bar);
    }
    this.emit();
    return true;
  }

  setMarkers(markers: readonly ChartMarker[]) {
    this.markers = [...markers].sort((a, b) => a.time - b.time);
    this.backend?.setMarkers(this.markers);
  }

  setPriceLine(line: ChartPriceLine) {
    this.lines.set(line.id, line);
    if (!this.backend) return;
    const handle = this.handles.get(line.id);
    if (handle) handle.update(line);
    else this.handles.set(line.id, this.backend.addPriceLine(line));
  }

  removePriceLine(id: string) {
    this.lines.delete(id);
    this.handles.get(id)?.remove();
    this.handles.delete(id);
  }

  clearPriceLines() {
    for (const id of [...this.lines.keys()]) this.removePriceLine(id);
  }

  priceLineIds(): string[] {
    return [...this.lines.keys()];
  }

  scrollTo(time: number) {
    const index = indexAtOrBefore(this.bars, time);
    if (index >= 0) this.backend?.centerOn(index);
  }

  fit() {
    this.backend?.fit();
  }

  setDisplay(patch: Partial<ChartDisplay>) {
    this.display = { ...this.display, ...patch };
    this.backend?.setDisplay(this.display);
  }

  resize(width: number, height: number) {
    if (width > 0 && height > 0) this.backend?.resize(width, height);
  }
}

export type ChartEnvironment = {
  container: HTMLElement;
  model: ChartModel;
  createBackend: ChartBackendFactory;
  readTheme: () => ChartTheme;
  observeResize: (element: HTMLElement, onSize: (width: number, height: number) => void) => () => void;
  subscribeTheme: (onChange: () => void) => () => void;
  onCrosshair?: (bar: CandleBar | null) => void;
};

/** Effect body for CandleChart: every resource it acquires is released by the returned detach. */
export function attachChart(env: ChartEnvironment): () => void {
  const { model } = env;
  model.display = { ...model.display, theme: env.readTheme() };
  const backend = env.createBackend(env.container, model.display);
  model.bind(backend);
  const stopResize = env.observeResize(env.container, (width, height) => model.resize(width, height));
  const stopTheme = env.subscribeTheme(() => model.setDisplay({ theme: env.readTheme() }));
  const stopCrosshair = env.onCrosshair ? backend.onCrosshair(env.onCrosshair) : () => {};
  let attached = true;
  return () => {
    if (!attached) return;
    attached = false;
    stopCrosshair();
    stopTheme();
    stopResize();
    model.unbind();
    backend.remove();
  };
}

export function observeElementSize(
  element: HTMLElement,
  onSize: (width: number, height: number) => void
): () => void {
  const observer = new ResizeObserver((entries) => {
    const box = entries[0]?.contentRect;
    if (box) onSize(Math.floor(box.width), Math.floor(box.height));
  });
  observer.observe(element);
  return () => observer.disconnect();
}
