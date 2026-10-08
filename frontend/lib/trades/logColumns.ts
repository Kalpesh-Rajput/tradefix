export type TradeColumnId =
  | "date"
  | "ticker"
  | "class"
  | "side"
  | "qty"
  | "entry"
  | "exit"
  | "strategy"
  | "pnl"
  | "roi"
  | "notes"
  | "entryTime"
  | "exitTime"
  | "held"
  | "fees"
  | "risk"
  | "rMultiple"
  | "status"
  | "session"
  | "mood"
  | "emotion"
  | "rating"
  | "account"
  | "stop"
  | "target"
  | "leverage"
  | "tradeType"
  | "rules";

export type TradeColumnDef = {
  id: TradeColumnId;
  label: string;
  minWidth: number;
};

export const TRADE_COLUMNS: TradeColumnDef[] = [
  { id: "date", label: "Date", minWidth: 100 },
  { id: "ticker", label: "Ticker", minWidth: 88 },
  { id: "class", label: "Class", minWidth: 100 },
  { id: "side", label: "Side", minWidth: 84 },
  { id: "qty", label: "Qty", minWidth: 100 },
  { id: "entry", label: "Entry", minWidth: 84 },
  { id: "exit", label: "Exit", minWidth: 84 },
  { id: "strategy", label: "Strategy", minWidth: 120 },
  { id: "pnl", label: "P&L", minWidth: 92 },
  { id: "roi", label: "Net ROI", minWidth: 84 },
  { id: "notes", label: "Notes", minWidth: 120 },
  { id: "entryTime", label: "Entry Time", minWidth: 168 },
  { id: "exitTime", label: "Exit Time", minWidth: 168 },
  { id: "held", label: "Held", minWidth: 96 },
  { id: "fees", label: "Fees", minWidth: 96 },
  { id: "risk", label: "Trade Risk", minWidth: 112 },
  { id: "rMultiple", label: "Realized R-Multiple", minWidth: 156 },
  { id: "status", label: "Status", minWidth: 92 },
  { id: "session", label: "Session", minWidth: 110 },
  { id: "mood", label: "Mood", minWidth: 120 },
  { id: "emotion", label: "Emotion", minWidth: 120 },
  { id: "rating", label: "Trade Rating", minWidth: 112 },
  { id: "account", label: "Account", minWidth: 130 },
  { id: "stop", label: "Stop loss", minWidth: 104 },
  { id: "target", label: "Profit Target", minWidth: 120 },
  { id: "leverage", label: "Leverage", minWidth: 92 },
  { id: "tradeType", label: "Trade type", minWidth: 120 },
  { id: "rules", label: "Rules", minWidth: 140 },
];

export const DEFAULT_TRADE_COLUMNS: TradeColumnId[] = [
  "date",
  "ticker",
  "class",
  "side",
  "qty",
  "entry",
  "exit",
  "strategy",
  "pnl",
  "roi",
  "notes",
];

export const SELECT_COL_WIDTH = 44;
export const ACTIONS_COL_WIDTH = 80;

const COLUMN_INDEX = new Map(TRADE_COLUMNS.map((column, index) => [column.id, index]));

export function columnDef(id: TradeColumnId): TradeColumnDef {
  return TRADE_COLUMNS[COLUMN_INDEX.get(id) ?? 0];
}

export function normalizeColumns(ids: unknown): TradeColumnId[] {
  if (!Array.isArray(ids)) return [...DEFAULT_TRADE_COLUMNS];
  const picked = new Set<TradeColumnId>();
  for (const id of ids) {
    if (typeof id === "string" && COLUMN_INDEX.has(id as TradeColumnId)) {
      picked.add(id as TradeColumnId);
    }
  }
  const ordered = TRADE_COLUMNS.map((column) => column.id).filter((id) => picked.has(id));
  return ordered.length ? ordered : [...DEFAULT_TRADE_COLUMNS];
}

export function columnsAreDefault(ids: TradeColumnId[]): boolean {
  return (
    ids.length === DEFAULT_TRADE_COLUMNS.length &&
    ids.every((id, index) => id === DEFAULT_TRADE_COLUMNS[index])
  );
}

export function tableMinWidth(ids: TradeColumnId[]): number {
  return (
    SELECT_COL_WIDTH +
    ACTIONS_COL_WIDTH +
    ids.reduce((sum, id) => sum + columnDef(id).minWidth, 0)
  );
}
