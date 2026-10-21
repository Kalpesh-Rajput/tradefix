import type { ChartTheme } from "../chartTheme";
import type { BarLike } from "./types";

export type Painter = (ctx: CanvasRenderingContext2D, width: number, height: number) => void;

/**
 * What the drawing layer needs from a chart. The Lightweight Charts backend implements it;
 * tests implement it with a linear fake.
 */
export interface DrawingSurface {
  container: HTMLElement;
  plotSize(): { width: number; height: number };
  logicalToX(logical: number): number | null;
  xToLogical(x: number): number | null;
  priceToY(price: number): number | null;
  yToPrice(y: number): number | null;
  bars(): readonly BarLike[];
  theme(): ChartTheme;
  attachPainter(paint: Painter): { requestRepaint(): void; detach(): void };
}
