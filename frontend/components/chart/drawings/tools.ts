import type { Drawing, DrawingProps, DrawingStyle, FibLevel, ToolId } from "./types";

export type ToolCategory = "lines" | "channels" | "fibonacci" | "shapes" | "text" | "measure" | "position";

export type ToolDef = {
  id: ToolId;
  label: string;
  category: ToolCategory;
  /** Anchors the user places. Positions finish with three anchors derived from two clicks. */
  clicks: number;
  shortcut?: string;
};

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  lines: "Lines",
  channels: "Channels",
  fibonacci: "Fibonacci",
  shapes: "Shapes",
  text: "Text & labels",
  measure: "Measure",
  position: "Forecasting",
};

export const CATEGORY_ORDER: ToolCategory[] = ["lines", "channels", "fibonacci", "shapes", "text", "measure", "position"];

export const TOOLS: ToolDef[] = [
  { id: "trendline", label: "Trend line", category: "lines", clicks: 2, shortcut: "T" },
  { id: "ray", label: "Ray", category: "lines", clicks: 2 },
  { id: "extended_line", label: "Extended line", category: "lines", clicks: 2 },
  { id: "info_line", label: "Info line", category: "lines", clicks: 2 },
  { id: "horizontal_line", label: "Horizontal line", category: "lines", clicks: 1, shortcut: "H" },
  { id: "horizontal_ray", label: "Horizontal ray", category: "lines", clicks: 1 },
  { id: "vertical_line", label: "Vertical line", category: "lines", clicks: 1, shortcut: "V" },
  { id: "crossline", label: "Cross line", category: "lines", clicks: 1 },
  { id: "parallel_channel", label: "Parallel channel", category: "channels", clicks: 3 },
  { id: "fib_retracement", label: "Fib retracement", category: "fibonacci", clicks: 2, shortcut: "F" },
  { id: "fib_extension", label: "Trend-based fib extension", category: "fibonacci", clicks: 3 },
  { id: "rectangle", label: "Rectangle", category: "shapes", clicks: 2, shortcut: "R" },
  { id: "ellipse", label: "Ellipse", category: "shapes", clicks: 2 },
  { id: "triangle", label: "Triangle", category: "shapes", clicks: 3 },
  { id: "arrow", label: "Arrow", category: "shapes", clicks: 2 },
  { id: "text", label: "Text", category: "text", clicks: 1 },
  { id: "price_label", label: "Price label", category: "text", clicks: 1 },
  { id: "price_range", label: "Price range", category: "measure", clicks: 2 },
  { id: "date_range", label: "Date range", category: "measure", clicks: 2 },
  { id: "date_price_range", label: "Date and price range", category: "measure", clicks: 2, shortcut: "M" },
  { id: "long_position", label: "Long position", category: "position", clicks: 2, shortcut: "L" },
  { id: "short_position", label: "Short position", category: "position", clicks: 2, shortcut: "S" },
];

const BY_ID = new Map(TOOLS.map((tool) => [tool.id, tool]));

export function toolDef(id: ToolId): ToolDef {
  return BY_ID.get(id)!;
}

export function isPosition(tool: ToolId): boolean {
  return tool === "long_position" || tool === "short_position";
}

export function isFib(tool: ToolId): boolean {
  return tool === "fib_retracement" || tool === "fib_extension";
}

export const RETRACEMENT_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
export const EXTENSION_LEVELS = [1.272, 1.618];

export function defaultFibLevels(tool: ToolId): FibLevel[] {
  const base = tool === "fib_extension" ? [0, 0.618, 1] : RETRACEMENT_LEVELS;
  const extras = tool === "fib_retracement" ? EXTENSION_LEVELS : [1.272, 1.618, 2.618];
  return [
    ...base.map((value) => ({ value, label: String(value), enabled: true })),
    ...extras.map((value) => ({ value, label: String(value), enabled: false })),
  ];
}

export function defaultStyle(tool: ToolId, accent: string): DrawingStyle {
  const area = tool === "rectangle" || tool === "ellipse" || tool === "triangle" || tool === "parallel_channel";
  return {
    color: accent,
    width: 2,
    dash: tool === "price_range" || tool === "date_range" || tool === "date_price_range" ? "dashed" : "solid",
    fill: area ? 0.12 : isFib(tool) || isPosition(tool) ? 0.14 : 0,
    fontSize: 12,
  };
}

export function defaultProps(tool: ToolId): DrawingProps {
  if (isFib(tool)) return { levels: defaultFibLevels(tool) };
  if (tool === "text") return { text: "Text" };
  if (isPosition(tool)) return { qty: 1 };
  return {};
}

export const SWATCHES = ["#4f46e5", "#2563eb", "#0891b2", "#16a34a", "#d97706", "#dc2626", "#db2777", "#7c3aed", "#64748b", "#111827"];

export function cloneDrawing(drawing: Drawing, id: string): Drawing {
  return {
    ...drawing,
    id,
    anchors: drawing.anchors.map((anchor) => ({ ...anchor })),
    style: { ...drawing.style },
    props: { ...drawing.props, levels: drawing.props.levels?.map((level) => ({ ...level })) },
  };
}
