import type { Shape } from "./shapeTypes";
import type { Pt } from "./types";

export const HIT_TOLERANCE = 6;
export const HANDLE_RADIUS = 7;

export function distanceToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function pointInPolygon(p: Pt, pts: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    const crosses = pts[i].y > p.y !== pts[j].y > p.y && p.x < ((pts[j].x - pts[i].x) * (p.y - pts[i].y)) / (pts[j].y - pts[i].y) + pts[i].x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function nearPolyline(p: Pt, pts: readonly Pt[], closed: boolean, tolerance: number): boolean {
  const count = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < count; i += 1) {
    if (distanceToSegment(p, pts[i], pts[(i + 1) % pts.length]) <= tolerance) return true;
  }
  return false;
}

export function labelBox(shape: Extract<Shape, { k: "label" }>, width: number): { x: number; y: number; w: number; h: number } {
  const lineHeight = shape.fontSize + 4;
  const h = shape.lines.length * lineHeight + 6;
  const x = shape.align === "left" ? shape.x : shape.align === "center" ? shape.x - width / 2 : shape.x - width;
  const y = shape.baseline === "top" ? shape.y : shape.baseline === "middle" ? shape.y - h / 2 : shape.y - h;
  return { x, y, w: width, h };
}

/** Approximate label width without a canvas, good enough for hit testing. */
export function estimateLabelWidth(shape: Extract<Shape, { k: "label" }>): number {
  const longest = shape.lines.reduce((max, line) => Math.max(max, line.length), 0);
  return longest * shape.fontSize * 0.58 + 12;
}

export function hitShape(shape: Shape, p: Pt, tolerance = HIT_TOLERANCE): boolean {
  if (shape.hit === "none") return false;
  switch (shape.k) {
    case "line":
      return distanceToSegment(p, shape.a, shape.b) <= tolerance;
    case "rect": {
      const inside = p.x >= shape.x && p.x <= shape.x + shape.w && p.y >= shape.y && p.y <= shape.y + shape.h;
      if (shape.hit === "fill" || (shape.fill && shape.hit !== "stroke")) return inside;
      const corners = [
        { x: shape.x, y: shape.y },
        { x: shape.x + shape.w, y: shape.y },
        { x: shape.x + shape.w, y: shape.y + shape.h },
        { x: shape.x, y: shape.y + shape.h },
      ];
      return nearPolyline(p, corners, true, tolerance);
    }
    case "ellipse": {
      if (shape.rx < 1 || shape.ry < 1) return false;
      const nx = (p.x - shape.cx) / shape.rx;
      const ny = (p.y - shape.cy) / shape.ry;
      const radius = Math.hypot(nx, ny);
      if (shape.hit === "fill" || (shape.fill && shape.hit !== "stroke")) return radius <= 1;
      return Math.abs(radius - 1) * Math.min(shape.rx, shape.ry) <= tolerance;
    }
    case "poly":
      if (shape.hit === "fill" || (shape.fill && shape.hit !== "stroke")) return pointInPolygon(p, shape.pts);
      return nearPolyline(p, shape.pts, shape.pts.length > 2, tolerance);
    case "arrowhead":
      return Math.hypot(p.x - shape.at.x, p.y - shape.at.y) <= shape.size;
    case "label": {
      const box = labelBox(shape, estimateLabelWidth(shape));
      return p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h;
    }
  }
}

export function hitShapes(shapes: readonly Shape[], p: Pt): boolean {
  return shapes.some((shape) => hitShape(shape, p));
}

/** Index of the handle under the pointer, or -1. */
export function hitHandle(handles: readonly Pt[], p: Pt): number {
  for (let i = handles.length - 1; i >= 0; i -= 1) {
    if (Math.hypot(p.x - handles[i].x, p.y - handles[i].y) <= HANDLE_RADIUS + 2) return i;
  }
  return -1;
}
