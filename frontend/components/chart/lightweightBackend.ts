import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type CandlestickData,
  type ChartOptions,
  type DeepPartial,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type BarData,
  type CreatePriceLineOptions,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import {
  indexAtOrBefore,
  type CandleBar,
  type ChartBackend,
  type ChartBackendFactory,
  type ChartDisplay,
  type ChartMarker,
  type ChartPriceLine,
} from "./chartModel";
import { withAlpha } from "./chartTheme";
import { formatCrosshairTime, formatTickMark } from "./chartTime";

const toTime = (ms: number) => Math.floor(ms / 1000) as UTCTimestamp;
const fromTime = (time: Time) => (typeof time === "number" ? time * 1000 : Date.parse(String(time)));

const LINE_STYLES: Record<NonNullable<ChartPriceLine["style"]>, LineStyle> = {
  solid: LineStyle.Solid,
  dashed: LineStyle.Dashed,
  dotted: LineStyle.Dotted,
};

function chartOptions(display: ChartDisplay): DeepPartial<ChartOptions> {
  const { theme, timeZone } = display;
  return {
    layout: {
      background: { type: ColorType.Solid, color: theme.background },
      textColor: theme.text,
      fontFamily: theme.fontFamily,
      fontSize: 11,
      attributionLogo: true,
    },
    grid: { vertLines: { color: theme.grid }, horzLines: { color: theme.grid } },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: { color: theme.crosshair, labelBackgroundColor: theme.crosshairLabel },
      horzLine: { color: theme.crosshair, labelBackgroundColor: theme.crosshairLabel },
    },
    rightPriceScale: { borderColor: theme.border },
    timeScale: {
      borderColor: theme.border,
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 8,
      tickMarkFormatter: (time: Time, tickType: number) => formatTickMark(fromTime(time), tickType, timeZone),
    },
    localization: { timeFormatter: (time: Time) => formatCrosshairTime(fromTime(time), timeZone) },
  };
}

function priceLineOptions(line: ChartPriceLine): CreatePriceLineOptions {
  return {
    price: line.price,
    color: line.color,
    lineWidth: line.width ?? 1,
    lineStyle: LINE_STYLES[line.style ?? "dashed"],
    axisLabelVisible: line.axisLabel ?? true,
    title: line.title ?? "",
  };
}

function volumeBar(bar: CandleBar, display: ChartDisplay) {
  const color = bar.close >= bar.open ? display.theme.up : display.theme.down;
  return { time: toTime(bar.time), value: bar.volume ?? 0, color: withAlpha(color, 0.35) };
}

export const createLightweightBackend: ChartBackendFactory = (container, initial) => {
  let display = initial;
  let bars: readonly CandleBar[] = [];
  const chart: IChartApi = createChart(container, {
    ...chartOptions(display),
    width: container.clientWidth,
    height: container.clientHeight,
  });
  const candles: ISeriesApi<"Candlestick"> = chart.addSeries(CandlestickSeries, {});
  const markers = createSeriesMarkers(candles, []);
  let volume: ISeriesApi<"Histogram"> | null = null;

  const applySeriesStyle = () => {
    const minMove = 10 ** -display.priceDecimals;
    candles.applyOptions({
      upColor: display.theme.up,
      downColor: display.theme.down,
      borderUpColor: display.theme.up,
      borderDownColor: display.theme.down,
      wickUpColor: display.theme.up,
      wickDownColor: display.theme.down,
      priceFormat: { type: "price", precision: display.priceDecimals, minMove },
    });
  };

  const syncVolume = () => {
    if (display.showVolume && !volume) {
      volume = chart.addSeries(HistogramSeries, { priceScaleId: "", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false });
      volume.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    } else if (!display.showVolume && volume) {
      chart.removeSeries(volume);
      volume = null;
    }
    volume?.setData(bars.map((bar) => volumeBar(bar, display)));
  };

  const toCandle = (bar: CandleBar): CandlestickData<UTCTimestamp> => ({
    time: toTime(bar.time),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
  });

  const backend: ChartBackend = {
    setBars(next) {
      bars = next;
      candles.setData(next.map(toCandle));
      volume?.setData(next.map((bar) => volumeBar(bar, display)));
    },
    updateBar(bar) {
      candles.update(toCandle(bar));
      volume?.update(volumeBar(bar, display));
    },
    setMarkers(next: readonly ChartMarker[]) {
      markers.setMarkers(
        next.map((m) => ({ id: m.id, time: toTime(m.time), position: m.position, shape: m.shape, color: m.color, text: m.text }))
      );
    },
    addPriceLine(line) {
      let handle: IPriceLine | null = candles.createPriceLine(priceLineOptions(line));
      return {
        update(next) {
          handle?.applyOptions(priceLineOptions(next));
        },
        remove() {
          if (handle) candles.removePriceLine(handle);
          handle = null;
        },
      };
    },
    centerOn(index) {
      const timeScale = chart.timeScale();
      const range = timeScale.getVisibleLogicalRange();
      const half = range ? (range.to - range.from) / 2 : 60;
      timeScale.setVisibleLogicalRange({ from: index - half, to: index + half });
    },
    fit() {
      chart.timeScale().fitContent();
    },
    setDisplay(next) {
      display = next;
      chart.applyOptions(chartOptions(display));
      applySeriesStyle();
      syncVolume();
    },
    resize(width, height) {
      chart.resize(width, height);
    },
    onCrosshair(handler) {
      const listener = (param: MouseEventParams<Time>) => {
        const raw = param.time === undefined ? undefined : param.seriesData.get(candles);
        if (!raw || !("open" in raw)) {
          handler(null);
          return;
        }
        const data = raw as BarData<Time>;
        const time = fromTime(param.time as Time);
        const match = bars[indexAtOrBefore(bars, time)];
        const volumeAt = match?.time === time ? match.volume : undefined;
        handler({ time, open: data.open, high: data.high, low: data.low, close: data.close, volume: volumeAt });
      };
      chart.subscribeCrosshairMove(listener);
      return () => chart.unsubscribeCrosshairMove(listener);
    },
    remove() {
      markers.detach();
      chart.remove();
    },
  };
  applySeriesStyle();
  syncVolume();
  return backend;
};
