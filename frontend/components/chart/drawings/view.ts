import type { DrawingSurface } from "./surface";
import type { View } from "./shapeTypes";
import { logicalToTime, timeToLogical } from "./timeMapper";
import { roundPrice } from "./metrics";
import type { Anchor, DrawingContext, Pt } from "./types";

export function makeView(surface: DrawingSurface, ctx: DrawingContext): View {
  const bars = surface.bars();
  const { width, height } = surface.plotSize();
  const timeToX = (time: number) => {
    const logical = timeToLogical(bars, time);
    return logical == null ? null : surface.logicalToX(logical);
  };
  return {
    width,
    height,
    bars,
    ctx,
    theme: surface.theme(),
    timeToX,
    priceToY: (price) => surface.priceToY(price),
    point: (anchor) => {
      const x = timeToX(anchor.t);
      const y = surface.priceToY(anchor.p);
      return x == null || y == null ? null : { x, y };
    },
  };
}

export function anchorAt(surface: DrawingSurface, ctx: DrawingContext, point: Pt): Anchor | null {
  const logical = surface.xToLogical(point.x);
  const price = surface.yToPrice(point.y);
  if (logical == null || price == null) return null;
  const time = logicalToTime(surface.bars(), logical);
  return time == null ? null : { t: time, p: roundPrice(price, ctx.priceDecimals) };
}
