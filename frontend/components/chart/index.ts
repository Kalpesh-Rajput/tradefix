import dynamic from "next/dynamic";
import { createElement } from "react";

export type { CandleChartHandle, CandleChartProps } from "./CandleChart";
export type { CandleBar, ChartMarker, ChartPriceLine } from "./chartModel";
export type { ChartTheme } from "./chartTheme";
export { withAlpha } from "./chartTheme";

export const CandleChart = dynamic(() => import("./CandleChart").then((m) => m.CandleChart), {
  ssr: false,
  loading: () =>
    createElement("div", {
      className: "h-full w-full animate-pulse rounded-lg bg-[var(--color-border-subtle)]",
      "aria-hidden": true,
    }),
});
