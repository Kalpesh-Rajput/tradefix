import type { ChartTheme } from "../chartTheme";
import type { Anchor, BarLike, Dash, DrawingContext, Pt } from "./types";

export type Stroke = { color: string; width: number; dash: Dash };
export type Fill = { color: string; alpha: number };
export type HitMode = "stroke" | "fill" | "none";

export type Shape =
  | { k: "line"; a: Pt; b: Pt; stroke: Stroke; hit?: HitMode }
  | { k: "rect"; x: number; y: number; w: number; h: number; fill?: Fill; stroke?: Stroke; hit?: HitMode }
  | { k: "ellipse"; cx: number; cy: number; rx: number; ry: number; fill?: Fill; stroke?: Stroke; hit?: HitMode }
  | { k: "poly"; pts: Pt[]; fill?: Fill; stroke?: Stroke; hit?: HitMode }
  | { k: "arrowhead"; at: Pt; from: Pt; color: string; size: number; hit?: HitMode }
  | {
      k: "label";
      x: number;
      y: number;
      lines: string[];
      align: "left" | "center" | "right";
      baseline: "top" | "middle" | "bottom";
      color: string;
      bg?: Fill;
      border?: string;
      fontSize: number;
      hit?: HitMode;
    };

/** Everything a tool needs to turn data anchors into pixels. */
export type View = {
  width: number;
  height: number;
  point: (anchor: Anchor) => Pt | null;
  priceToY: (price: number) => number | null;
  timeToX: (time: number) => number | null;
  bars: readonly BarLike[];
  ctx: DrawingContext;
  theme: ChartTheme;
};

export type Built = { shapes: Shape[]; handles: Pt[] };
