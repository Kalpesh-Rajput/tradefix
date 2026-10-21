export type Anchor = { t: number; p: number };

export type Dash = "solid" | "dashed" | "dotted";

export type DrawingStyle = {
  color: string;
  width: number;
  dash: Dash;
  fill: number;
  fontSize: number;
};

export type FibLevel = { value: number; label: string; enabled: boolean };

export type DrawingProps = {
  text?: string;
  levels?: FibLevel[];
  qty?: number;
  extendLeft?: boolean;
  extendRight?: boolean;
};

export const TOOL_IDS = [
  "trendline", "ray", "extended_line", "horizontal_line", "horizontal_ray", "vertical_line", "crossline", "info_line",
  "parallel_channel", "fib_retracement", "fib_extension", "rectangle", "ellipse", "triangle", "arrow",
  "text", "price_label", "price_range", "date_range", "date_price_range", "long_position", "short_position",
] as const;

export type ToolId = (typeof TOOL_IDS)[number];

export type Drawing = {
  id: string;
  tool: ToolId;
  symbol: string;
  source: string | null;
  timeframe: string | null;
  anchors: Anchor[];
  style: DrawingStyle;
  props: DrawingProps;
  visible: boolean;
  locked: boolean;
  z: number;
  schemaVersion: number;
};

export const SCHEMA_VERSION = 1;

/** Instrument facts a drawing may need. Optional fields mean "unknown": never guess them. */
export type DrawingContext = {
  priceDecimals: number;
  pipSize?: number;
  contractSize?: number;
  assetClass?: string;
  quoteCurrency?: string;
  accountCurrency?: string;
};

export type Pt = { x: number; y: number };

export type BarLike = { time: number; volume?: number };
