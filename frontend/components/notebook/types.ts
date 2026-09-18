export type SystemFolder = "all" | "trades" | "daily" | "recaps" | "favorites";

export type NotebookFolderId = SystemFolder | string;

export type NotebookPane = "folders" | "list" | "editor";

export type NotebookSort = "newest" | "oldest";

export type DayListItem = {
  kind: "day";
  id: string;
  date: string;
  title: string;
  numericDate: string;
  favorite: boolean;
  shots: number;
  folderId: string | null;
  searchText?: string;
};

export type TradeListItem = {
  kind: "trade";
  id: string;
  date: string;
  title: string;
  subtitle: string;
  pnl: number;
  shots: number;
  hasNote: boolean;
};

export type RecapListItem = {
  kind: "recap";
  id: string;
  date: string;
  title: string;
  numericDate: string;
  subtitle: string;
  searchText?: string;
};

export type NotebookListItem = DayListItem | TradeListItem | RecapListItem;

export const SYSTEM_FOLDERS: { id: SystemFolder; label: string; initial: string }[] = [
  { id: "all", label: "All notes", initial: "A" },
  { id: "trades", label: "Trade Notes", initial: "T" },
  { id: "daily", label: "Daily Journal", initial: "D" },
  { id: "recaps", label: "Sessions Recap", initial: "S" },
  { id: "favorites", label: "My notes", initial: "M" },
];

export const FOLDERS = SYSTEM_FOLDERS;

export const FOLDERS_COLLAPSE_KEY = "tradefix_notebook_folders_collapsed";
export const TEMPLATE_RECENT_KEY = "tradefix_note_template_recent";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isSystemFolder(id: string): id is SystemFolder {
  return SYSTEM_FOLDERS.some((folder) => folder.id === id);
}

export function isCustomFolderId(id: string) {
  return UUID_RE.test(id);
}

export function parseFolder(params: URLSearchParams): NotebookFolderId {
  const folder = params.get("folder");
  if (folder && isCustomFolderId(folder)) return folder;
  if (folder && isSystemFolder(folder)) return folder;
  if (params.get("tab") === "trades") return "trades";
  return "daily";
}

export function folderShowsLogDay(folder: NotebookFolderId) {
  return folder !== "trades";
}

