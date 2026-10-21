import { compactNumber, fibPrices, formatDuration, measure, positionMetrics, signed } from "./metrics";
import type { Built, Shape, Stroke, View } from "./shapeTypes";
import type { Drawing, Pt } from "./types";

const LEVEL_COLORS = ["#787b86", "#f23645", "#ff9800", "#4caf50", "#089981", "#00bcd4", "#2962ff", "#9c27b0", "#e91e63", "#795548"];

function label(partial: Partial<Extract<Shape, { k: "label" }>> & { x: number; y: number; lines: string[]; color: string; fontSize: number }): Shape {
  return { k: "label", align: "left", baseline: "middle", hit: "none", ...partial };
}

function buildFib(drawing: Drawing, view: View, points: Pt[]): Built {
  const base: Stroke = { color: drawing.style.color, width: 1, dash: "dashed" };
  const shapes: Shape[] = [];
  const [a, b, c] = points;
  const extension = drawing.tool === "fib_extension";
  shapes.push({ k: "line", a, b, stroke: base });
  if (extension && c) shapes.push({ k: "line", a: b, b: c, stroke: base });
  const anchorsOnX = extension && c ? [a.x, b.x, c.x] : [a.x, b.x];
  const left = Math.min(...anchorsOnX);
  const right = Math.max(...anchorsOnX);
  const rows = fibPrices(drawing, view.ctx)
    .map((row, index) => ({ row, y: view.priceToY(row.price), color: LEVEL_COLORS[index % LEVEL_COLORS.length] }))
    .filter((entry): entry is { row: (typeof entry)["row"]; y: number; color: string } => entry.y != null)
    .sort((p, q) => p.y - q.y);
  if (drawing.style.fill > 0) {
    for (let i = 0; i < rows.length - 1; i += 1) {
      shapes.push({ k: "rect", x: left, y: rows[i].y, w: right - left, h: rows[i + 1].y - rows[i].y, fill: { color: rows[i].color, alpha: drawing.style.fill * 0.6 }, hit: "none" });
    }
  }
  for (const { row, y, color } of rows) {
    shapes.push({ k: "line", a: { x: left, y }, b: { x: right, y }, stroke: { color, width: drawing.style.width > 1 ? 1 : drawing.style.width, dash: "solid" } });
    shapes.push(
      label({
        x: left - 6,
        y,
        lines: [`${row.level.label} (${row.price.toFixed(view.ctx.priceDecimals)})`],
        align: "right",
        color,
        fontSize: drawing.style.fontSize - 1,
      })
    );
  }
  return { shapes, handles: points };
}

function buildMeasure(drawing: Drawing, view: View, points: Pt[]): Built {
  const [a, b] = points;
  const [first, second] = drawing.anchors;
  const m = measure(first, second, view.bars, view.ctx);
  const up = m.priceDiff >= 0;
  const color = up ? view.theme.up : view.theme.down;
  const stroke: Stroke = { color, width: 1, dash: "solid" };
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const w = Math.abs(b.x - a.x);
  const h = Math.abs(b.y - a.y);
  const decimals = view.ctx.priceDecimals;
  const lines: string[] = [];
  if (drawing.tool !== "date_range") {
    const unit = m.pips != null ? ` · ${Math.abs(m.pips).toFixed(1)} pips` : ` · ${Math.abs(m.ticks)} ticks`;
    lines.push(`${signed(m.priceDiff, decimals)}${m.percent != null ? ` (${signed(m.percent, 2)}%)` : ""}${unit}`);
  }
  if (drawing.tool !== "price_range") {
    lines.push(`${m.bars} bars · ${formatDuration(m.elapsedMs)}`);
    if (m.volume != null) lines.push(`Vol ${compactNumber(m.volume)}`);
  }
  const shapes: Shape[] = [];
  if (drawing.tool === "date_range") {
    shapes.push({ k: "rect", x, y: 0, w, h: view.height, fill: { color: drawing.style.color, alpha: 0.08 }, hit: "fill" });
    shapes.push({ k: "line", a: { x: a.x, y: 0 }, b: { x: a.x, y: view.height }, stroke: { ...stroke, color: drawing.style.color, dash: "dashed" } });
    shapes.push({ k: "line", a: { x: b.x, y: 0 }, b: { x: b.x, y: view.height }, stroke: { ...stroke, color: drawing.style.color, dash: "dashed" } });
    shapes.push({ k: "line", a: { x: a.x, y: a.y }, b: { x: b.x, y: a.y }, stroke: { ...stroke, color: drawing.style.color } });
    shapes.push({ k: "arrowhead", at: { x: b.x, y: a.y }, from: { x: a.x, y: a.y }, color: drawing.style.color, size: 8 });
  } else {
    shapes.push({ k: "rect", x, y, w: Math.max(w, 1), h, fill: { color, alpha: 0.16 }, stroke, hit: "fill" });
    const cx = drawing.tool === "price_range" ? x + w / 2 : x + w / 2;
    shapes.push({ k: "line", a: { x: cx, y: a.y }, b: { x: cx, y: b.y }, stroke });
    shapes.push({ k: "arrowhead", at: { x: cx, y: b.y }, from: { x: cx, y: a.y }, color, size: 8 });
    if (drawing.tool === "date_price_range") {
      shapes.push({ k: "line", a: { x: a.x, y: (a.y + b.y) / 2 }, b: { x: b.x, y: (a.y + b.y) / 2 }, stroke });
      shapes.push({ k: "arrowhead", at: { x: b.x, y: (a.y + b.y) / 2 }, from: { x: a.x, y: (a.y + b.y) / 2 }, color, size: 8 });
    }
  }
  shapes.push(
    label({
      x: x + w / 2,
      y: drawing.tool === "date_range" ? Math.min(a.y, b.y) - 8 : up ? y - 6 : y + h + 6,
      lines,
      align: "center",
      baseline: drawing.tool === "date_range" || up ? "bottom" : "top",
      color: "#ffffff",
      bg: { color, alpha: 0.95 },
      fontSize: drawing.style.fontSize,
    })
  );
  return { shapes, handles: points };
}

function buildPosition(drawing: Drawing, view: View, points: Pt[]): Built {
  const [entry, stop, target] = points;
  const metrics = positionMetrics(drawing, view.bars, view.ctx);
  const left = entry.x;
  const right = Math.max(stop.x, left + 24);
  const decimals = view.ctx.priceDecimals;
  const shapes: Shape[] = [
    { k: "rect", x: left, y: Math.min(entry.y, target.y), w: right - left, h: Math.abs(target.y - entry.y), fill: { color: view.theme.up, alpha: 0.18 }, hit: "fill" },
    { k: "rect", x: left, y: Math.min(entry.y, stop.y), w: right - left, h: Math.abs(stop.y - entry.y), fill: { color: view.theme.down, alpha: 0.18 }, hit: "fill" },
    { k: "line", a: { x: left, y: entry.y }, b: { x: right, y: entry.y }, stroke: { color: drawing.style.color, width: 1, dash: "solid" } },
    { k: "line", a: { x: left, y: target.y }, b: { x: right, y: target.y }, stroke: { color: view.theme.up, width: 1, dash: "solid" } },
    { k: "line", a: { x: left, y: stop.y }, b: { x: right, y: stop.y }, stroke: { color: view.theme.down, width: 1, dash: "solid" } },
  ];
  if (metrics) {
    const ratio = metrics.ratio != null ? `${metrics.ratio.toFixed(2)}` : "—";
    const pnl = (value: number | null) => (value != null && metrics.pnlCurrency ? ` · ${signed(value, 2)} ${metrics.pnlCurrency}` : "");
    const cx = (left + right) / 2;
    shapes.push(
      label({
        x: cx,
        y: target.y + (target.y < entry.y ? -6 : 6),
        baseline: target.y < entry.y ? "bottom" : "top",
        align: "center",
        lines: [`Target ${metrics.target.toFixed(decimals)} · ${signed(metrics.rewardPercent, 2)}%${pnl(metrics.rewardPnl)}`],
        color: "#ffffff",
        bg: { color: view.theme.up, alpha: 0.95 },
        fontSize: drawing.style.fontSize - 1,
      }),
      label({
        x: cx,
        y: stop.y + (stop.y > entry.y ? 6 : -6),
        baseline: stop.y > entry.y ? "top" : "bottom",
        align: "center",
        lines: [`Stop ${metrics.stop.toFixed(decimals)} · −${Math.abs(metrics.riskPercent).toFixed(2)}%${pnl(metrics.riskPnl)}`],
        color: "#ffffff",
        bg: { color: view.theme.down, alpha: 0.95 },
        fontSize: drawing.style.fontSize - 1,
      }),
      label({
        x: cx,
        y: entry.y,
        align: "center",
        lines: [`R/R ${ratio} · risk ${Math.abs(metrics.risk).toFixed(decimals)} · reward ${Math.abs(metrics.reward).toFixed(decimals)}`],
        color: view.theme.text,
        bg: { color: view.theme.background, alpha: 0.92 },
        border: drawing.style.color,
        fontSize: drawing.style.fontSize - 1,
      })
    );
  }
  return { shapes, handles: [entry, stop, target] };
}

export function buildAnalysis(drawing: Drawing, view: View, points: Pt[]): Built {
  if (drawing.tool === "fib_retracement" || drawing.tool === "fib_extension") {
    if (points.length < (drawing.tool === "fib_extension" ? 3 : 2)) {
      return { shapes: [{ k: "line", a: points[0], b: points[1] ?? points[0], stroke: { color: drawing.style.color, width: 1, dash: "dashed" } }], handles: points };
    }
    return buildFib(drawing, view, points);
  }
  if (drawing.tool === "long_position" || drawing.tool === "short_position") {
    return points.length >= 3 ? buildPosition(drawing, view, points) : { shapes: [], handles: points };
  }
  if (points.length < 2) return { shapes: [], handles: points };
  return buildMeasure(drawing, view, points);
}
