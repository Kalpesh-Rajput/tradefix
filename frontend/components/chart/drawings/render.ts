import { HANDLE_RADIUS, labelBox } from "./hit";
import type { Fill, Shape, Stroke } from "./shapeTypes";
import type { Pt } from "./types";

const DASH: Record<Stroke["dash"], number[]> = { solid: [], dashed: [6, 4], dotted: [2, 3] };

function applyStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.setLineDash(DASH[stroke.dash]);
}

function fillPath(ctx: CanvasRenderingContext2D, fill: Fill) {
  ctx.save();
  ctx.globalAlpha = fill.alpha;
  ctx.fillStyle = fill.color;
  ctx.fill();
  ctx.restore();
}

function paintShape(ctx: CanvasRenderingContext2D, shape: Shape) {
  switch (shape.k) {
    case "line":
      applyStroke(ctx, shape.stroke);
      ctx.beginPath();
      ctx.moveTo(shape.a.x, shape.a.y);
      ctx.lineTo(shape.b.x, shape.b.y);
      ctx.stroke();
      break;
    case "rect":
      ctx.beginPath();
      ctx.rect(shape.x, shape.y, shape.w, shape.h);
      if (shape.fill) fillPath(ctx, shape.fill);
      if (shape.stroke) {
        applyStroke(ctx, shape.stroke);
        ctx.stroke();
      }
      break;
    case "ellipse":
      ctx.beginPath();
      ctx.ellipse(shape.cx, shape.cy, Math.max(shape.rx, 0.5), Math.max(shape.ry, 0.5), 0, 0, Math.PI * 2);
      if (shape.fill) fillPath(ctx, shape.fill);
      if (shape.stroke) {
        applyStroke(ctx, shape.stroke);
        ctx.stroke();
      }
      break;
    case "poly":
      ctx.beginPath();
      shape.pts.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
      if (shape.pts.length > 2) ctx.closePath();
      if (shape.fill) fillPath(ctx, shape.fill);
      if (shape.stroke) {
        applyStroke(ctx, shape.stroke);
        ctx.stroke();
      }
      break;
    case "arrowhead": {
      const angle = Math.atan2(shape.at.y - shape.from.y, shape.at.x - shape.from.x);
      ctx.setLineDash([]);
      ctx.fillStyle = shape.color;
      ctx.beginPath();
      ctx.moveTo(shape.at.x, shape.at.y);
      ctx.lineTo(shape.at.x - shape.size * Math.cos(angle - 0.4), shape.at.y - shape.size * Math.sin(angle - 0.4));
      ctx.lineTo(shape.at.x - shape.size * Math.cos(angle + 0.4), shape.at.y - shape.size * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "label": {
      ctx.setLineDash([]);
      ctx.font = `500 ${shape.fontSize}px system-ui, sans-serif`;
      const width = Math.max(...shape.lines.map((line) => ctx.measureText(line).width)) + 12;
      const box = labelBox(shape, width);
      if (shape.bg) {
        ctx.beginPath();
        ctx.roundRect(box.x, box.y, box.w, box.h, 4);
        fillPath(ctx, shape.bg);
        if (shape.border) {
          ctx.strokeStyle = shape.border;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
      ctx.fillStyle = shape.color;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      const lineHeight = shape.fontSize + 4;
      shape.lines.forEach((line, i) => ctx.fillText(line, box.x + 6, box.y + 3 + lineHeight * (i + 0.5)));
      break;
    }
  }
}

export function paintShapes(ctx: CanvasRenderingContext2D, shapes: readonly Shape[], alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const shape of shapes) paintShape(ctx, shape);
  ctx.restore();
}

export function paintHandles(ctx: CanvasRenderingContext2D, handles: readonly Pt[], color: string, background: string) {
  ctx.save();
  ctx.setLineDash([]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.fillStyle = background;
  for (const handle of handles) {
    ctx.beginPath();
    ctx.arc(handle.x, handle.y, HANDLE_RADIUS - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
