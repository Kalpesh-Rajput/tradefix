import { TOOL_IDS, SCHEMA_VERSION, type Drawing, type DrawingProps, type DrawingStyle, type ToolId } from "@/components/chart/drawings/types";

export type DrawingDto = {
  id: string;
  tool: string;
  symbol: string;
  source: string | null;
  timeframe: string | null;
  anchors: { time_ms: number; price: number }[];
  style: Record<string, unknown>;
  props: Record<string, unknown>;
  visible: boolean;
  locked: boolean;
  z_order: number;
  schema_version: number;
};

export type SyncBody = {
  workspace: string;
  session_id: string | null;
  upserts: DrawingDto[];
  deletes: string[];
};

const FALLBACK_STYLE: DrawingStyle = { color: "#4f46e5", width: 2, dash: "solid", fill: 0, fontSize: 12 };

function isTool(value: string): value is ToolId {
  return (TOOL_IDS as readonly string[]).includes(value);
}

export function toDto(drawing: Drawing): DrawingDto {
  return {
    id: drawing.id,
    tool: drawing.tool,
    symbol: drawing.symbol,
    source: drawing.source,
    timeframe: drawing.timeframe,
    anchors: drawing.anchors.map((anchor) => ({ time_ms: Math.round(anchor.t), price: anchor.p })),
    style: { ...drawing.style },
    props: { ...drawing.props },
    visible: drawing.visible,
    locked: drawing.locked,
    z_order: Math.max(0, Math.round(drawing.z)),
    schema_version: drawing.schemaVersion,
  };
}

/** Rows from an unknown tool or newer schema are skipped so an old client never corrupts them. */
export function fromDto(dto: DrawingDto): Drawing | null {
  if (!isTool(dto.tool) || dto.schema_version > SCHEMA_VERSION) return null;
  return {
    id: dto.id,
    tool: dto.tool,
    symbol: dto.symbol,
    source: dto.source,
    timeframe: dto.timeframe,
    anchors: dto.anchors.map((anchor) => ({ t: anchor.time_ms, p: anchor.price })),
    style: { ...FALLBACK_STYLE, ...(dto.style as Partial<DrawingStyle>) },
    props: dto.props as DrawingProps,
    visible: dto.visible,
    locked: dto.locked,
    z: dto.z_order,
    schemaVersion: dto.schema_version,
  };
}
