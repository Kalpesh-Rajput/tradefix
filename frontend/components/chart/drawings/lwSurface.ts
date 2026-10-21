import type {
  IChartApi,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  Logical,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";

import type { ChartTheme } from "../chartTheme";
import type { DrawingSurface, Painter } from "./surface";
import type { BarLike } from "./types";

type DrawTarget = Parameters<IPrimitivePaneRenderer["draw"]>[0];

/** Series primitive: the chart calls it on every redraw, so drawings follow zoom, scroll and price-scale changes. */
class DrawingPrimitive implements ISeriesPrimitive<Time> {
  private requestUpdate: (() => void) | null = null;
  painter: Painter | null = null;

  private readonly pane: IPrimitivePaneView = {
    zOrder: () => "top",
    renderer: () => ({
      draw: (target: DrawTarget) => {
        const paint = this.painter;
        if (!paint) return;
        target.useMediaCoordinateSpace(({ context, mediaSize }) => paint(context, mediaSize.width, mediaSize.height));
      },
    }),
  };

  attached(param: SeriesAttachedParameter<Time>) {
    this.requestUpdate = param.requestUpdate;
  }

  detached() {
    this.requestUpdate = null;
    this.painter = null;
  }

  paneViews() {
    return [this.pane];
  }

  repaint() {
    this.requestUpdate?.();
  }
}

export function createLightweightSurface(
  container: HTMLElement,
  chart: IChartApi,
  series: ISeriesApi<"Candlestick">,
  bars: () => readonly BarLike[],
  theme: () => ChartTheme
): DrawingSurface {
  return {
    container,
    plotSize: () => chart.paneSize(),
    logicalToX: (logical) => chart.timeScale().logicalToCoordinate(logical as Logical),
    xToLogical: (x) => chart.timeScale().coordinateToLogical(x),
    priceToY: (price) => series.priceToCoordinate(price),
    yToPrice: (y) => series.coordinateToPrice(y),
    bars,
    theme,
    attachPainter(paint) {
      const primitive = new DrawingPrimitive();
      primitive.painter = paint;
      series.attachPrimitive(primitive);
      return {
        requestRepaint: () => primitive.repaint(),
        detach: () => series.detachPrimitive(primitive),
      };
    },
  };
}
