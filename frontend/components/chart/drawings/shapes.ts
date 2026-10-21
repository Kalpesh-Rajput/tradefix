import { buildAnalysis } from "./shapesAnalysis";
import type { Built, Shape, Stroke, View } from "./shapeTypes";
import { formatDuration, measure, signed } from "./metrics";
import type { Drawing, Pt } from "./types";

const FAR = 100_000;

export function strokeOf(drawing: Drawing): Stroke {
  return { color: drawing.style.color, width: drawing.style.width, dash: drawing.style.dash };
}

function extend(a: Pt, b: Pt, factor: number): Pt {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: a.x + (dx / length) * factor, y: a.y + (dy / length) * factor };
}

function segment(a: Pt, b: Pt, stroke: Stroke): Shape {
  return { k: "line", a, b, stroke };
}

function infoLabel(drawing: Drawing, view: View, a: Pt, b: Pt): Shape {
  const [first, second] = drawing.anchors;
  const m = measure(first, second, view.bars, view.ctx);
  const decimals = view.ctx.priceDecimals;
  const lines = [
    `${signed(m.priceDiff, decimals)}${m.percent != null ? ` (${signed(m.percent, 2)}%)` : ""}`,
    `${m.bars} bars · ${formatDuration(m.elapsedMs)}`,
  ];
  return {
    k: "label",
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2 - 8,
    lines,
    align: "center",
    baseline: "bottom",
    color: view.theme.text,
    bg: { color: view.theme.background, alpha: 0.85 },
    border: drawing.style.color,
    fontSize: drawing.style.fontSize,
    hit: "none",
  };
}

function buildLine(drawing: Drawing, view: View, points: Pt[]): Shape[] {
  const stroke = strokeOf(drawing);
  const { tool } = drawing;
  const [a, b] = points;
  if (tool === "horizontal_line") return [segment({ x: -FAR, y: a.y }, { x: FAR, y: a.y }, stroke)];
  if (tool === "horizontal_ray") return [segment(a, { x: FAR, y: a.y }, stroke)];
  if (tool === "vertical_line") return [segment({ x: a.x, y: -FAR }, { x: a.x, y: FAR }, stroke)];
  if (tool === "crossline") {
    return [segment({ x: -FAR, y: a.y }, { x: FAR, y: a.y }, stroke), segment({ x: a.x, y: -FAR }, { x: a.x, y: FAR }, stroke)];
  }
  if (!b) return [];
  if (tool === "ray") return [segment(a, extend(a, b, FAR), stroke)];
  if (tool === "extended_line") return [segment(extend(b, a, FAR), extend(a, b, FAR), stroke)];
  const shapes = [segment(a, b, stroke)];
  if (tool === "info_line") shapes.push(infoLabel(drawing, view, a, b));
  return shapes;
}

function buildArea(drawing: Drawing, view: View, points: Pt[]): Shape[] {
  const stroke = strokeOf(drawing);
  const fill = drawing.style.fill > 0 ? { color: drawing.style.color, alpha: drawing.style.fill } : undefined;
  const [a, b, c] = points;
  if (drawing.tool === "rectangle" && b) {
    return [{ k: "rect", x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y), fill, stroke }];
  }
  if (drawing.tool === "ellipse" && b) {
    return [{ k: "ellipse", cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, rx: Math.abs(b.x - a.x) / 2, ry: Math.abs(b.y - a.y) / 2, fill, stroke }];
  }
  if (drawing.tool === "triangle" && b) return [{ k: "poly", pts: c ? [a, b, c] : [a, b], fill: c ? fill : undefined, stroke }];
  if (drawing.tool === "arrow" && b) return [segment(a, b, stroke), { k: "arrowhead", at: b, from: a, color: stroke.color, size: 8 + stroke.width * 2 }];
  if (drawing.tool === "parallel_channel" && b) {
    if (!c) return [segment(a, b, stroke)];
    const slope = (b.y - a.y) / (b.x - a.x || 1e-9);
    const offset = c.y - (a.y + slope * (c.x - a.x));
    const a2 = { x: a.x, y: a.y + offset };
    const b2 = { x: b.x, y: b.y + offset };
    const mid = { ...stroke, dash: "dashed" as const, width: 1 };
    return [
      { k: "poly", pts: [a, b, b2, a2], fill, hit: "none" },
      segment(a, b, stroke),
      segment(a2, b2, stroke),
      segment({ x: a.x, y: a.y + offset / 2 }, { x: b.x, y: b.y + offset / 2 }, mid),
    ];
  }
  return [];
}

function buildText(drawing: Drawing, view: View, a: Pt): Shape[] {
  const color = drawing.style.color;
  if (drawing.tool === "price_label") {
    const text = drawing.anchors[0].p.toFixed(view.ctx.priceDecimals);
    return [{ k: "label", x: a.x, y: a.y, lines: [text], align: "left", baseline: "middle", color: "#ffffff", bg: { color, alpha: 1 }, fontSize: drawing.style.fontSize }];
  }
  const text = (drawing.props.text ?? "").trim() || "Text";
  return [{ k: "label", x: a.x, y: a.y, lines: text.split("\n").slice(0, 6), align: "left", baseline: "middle", color, bg: { color: view.theme.background, alpha: 0.7 }, fontSize: drawing.style.fontSize }];
}

const LINE_TOOLS = new Set(["trendline", "ray", "extended_line", "info_line", "horizontal_line", "horizontal_ray", "vertical_line", "crossline"]);
const AREA_TOOLS = new Set(["rectangle", "ellipse", "triangle", "arrow", "parallel_channel"]);

export function buildShapes(drawing: Drawing, view: View): Built {
  const points: Pt[] = [];
  for (const anchor of drawing.anchors) {
    const point = view.point(anchor);
    if (!point) return { shapes: [], handles: [] };
    points.push(point);
  }
  if (!points.length) return { shapes: [], handles: [] };
  let shapes: Shape[];
  if (LINE_TOOLS.has(drawing.tool)) shapes = buildLine(drawing, view, points);
  else if (AREA_TOOLS.has(drawing.tool)) shapes = buildArea(drawing, view, points);
  else if (drawing.tool === "text" || drawing.tool === "price_label") shapes = buildText(drawing, view, points[0]);
  else return buildAnalysis(drawing, view, points);
  return { shapes, handles: points };
}