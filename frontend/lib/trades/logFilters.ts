import { moodsFromTrade } from "@/lib/masters";
import type { AssetType, Trade, TradeSide } from "@/lib/types";

export type StatusTab = "all" | "open" | "closed";
export type HoldingFilter = "" | "intraday" | "multiday";
export type PnlFilter = "" | "profit" | "loss" | "breakeven";
export type SignFilter = "" | "positive" | "negative";
export type PresenceFilter = "" | "with" | "without";
export type RatingFilter = "" | "1" | "2" | "3" | "4" | "5" | "unrated";
export type RMultipleFilter = "" | "positive" | "negative" | "none";
export type WeekdayFilter = "" | "0" | "1" | "2" | "3" | "4" | "5" | "6";
export type JournalFilter = "" | "journaled" | "unjournaled";
export type RulesFilter = "" | "broken" | "clean";

export type AdvancedFilterValue = {
  status: StatusTab;
  asset_type: AssetType | "";
  side: TradeSide | "";
  setup_tag: string;
  symbol: string;
  session: string;
  holding: HoldingFilter;
  pnl: PnlFilter;
  fees: PresenceFilter;
  risk: PresenceFilter;
  roi: SignFilter;
  rating: RatingFilter;
  r_multiple: RMultipleFilter;
  weekday: WeekdayFilter;
  mood: string;
  emotion: string;
  journal: JournalFilter;
  rules: RulesFilter;
};

export type LocalFilters = AdvancedFilterValue & {
  search: string;
  dateFrom: string;
  dateTo: string;
  ids: string;
  auto_flag: string;
};

export const DEFAULT_FILTERS: LocalFilters = {
  search: "",
  dateFrom: "",
  dateTo: "",
  status: "all",
  asset_type: "",
  side: "",
  setup_tag: "",
  symbol: "",
  session: "",
  ids: "",
  auto_flag: "",
  holding: "",
  pnl: "",
  fees: "",
  risk: "",
  roi: "",
  rating: "",
  r_multiple: "",
  weekday: "",
  mood: "",
  emotion: "",
  journal: "",
  rules: "",
};

const STATUSES: StatusTab[] = ["all", "open", "closed"];
const SIDES: Array<TradeSide | ""> = ["", "long", "short"];
const ASSETS: Array<AssetType | ""> = ["", "stock", "option", "future", "forex", "crypto"];
const HOLDING: HoldingFilter[] = ["", "intraday", "multiday"];
const PNL: PnlFilter[] = ["", "profit", "loss", "breakeven"];
const SIGN: SignFilter[] = ["", "positive", "negative"];
const PRESENCE: PresenceFilter[] = ["", "with", "without"];
const RATINGS: RatingFilter[] = ["", "1", "2", "3", "4", "5", "unrated"];
const R_MULTIPLE: RMultipleFilter[] = ["", "positive", "negative", "none"];
const WEEKDAYS: WeekdayFilter[] = ["", "0", "1", "2", "3", "4", "5", "6"];
const JOURNAL: JournalFilter[] = ["", "journaled", "unjournaled"];
const RULES: RulesFilter[] = ["", "broken", "clean"];

type StoredFilters = Partial<LocalFilters> & { has_rules_broken?: boolean };

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function completeFilters(partial?: StoredFilters | null): LocalFilters {
  const source = partial ?? {};
  const rules = oneOf(source.rules, RULES, "");
  return {
    search: asString(source.search),
    dateFrom: asString(source.dateFrom),
    dateTo: asString(source.dateTo),
    status: oneOf(source.status, STATUSES, "all"),
    asset_type: oneOf(source.asset_type, ASSETS, ""),
    side: oneOf(source.side, SIDES, ""),
    setup_tag: asString(source.setup_tag),
    symbol: asString(source.symbol),
    session: asString(source.session),
    ids: asString(source.ids),
    auto_flag: asString(source.auto_flag),
    holding: oneOf(source.holding, HOLDING, ""),
    pnl: oneOf(source.pnl, PNL, ""),
    fees: oneOf(source.fees, PRESENCE, ""),
    risk: oneOf(source.risk, PRESENCE, ""),
    roi: oneOf(source.roi, SIGN, ""),
    rating: oneOf(source.rating, RATINGS, ""),
    r_multiple: oneOf(source.r_multiple, R_MULTIPLE, ""),
    weekday: oneOf(source.weekday, WEEKDAYS, ""),
    mood: asString(source.mood),
    emotion: asString(source.emotion),
    journal: oneOf(source.journal, JOURNAL, ""),
    rules: rules || (source.has_rules_broken ? "broken" : ""),
  };
}

export function pickAdvanced(filters: LocalFilters): AdvancedFilterValue {
  return {
    status: filters.status,
    asset_type: filters.asset_type,
    side: filters.side,
    setup_tag: filters.setup_tag,
    symbol: filters.symbol,
    session: filters.session,
    holding: filters.holding,
    pnl: filters.pnl,
    fees: filters.fees,
    risk: filters.risk,
    roi: filters.roi,
    rating: filters.rating,
    r_multiple: filters.r_multiple,
    weekday: filters.weekday,
    mood: filters.mood,
    emotion: filters.emotion,
    journal: filters.journal,
    rules: filters.rules,
  };
}

export function advancedFilterCount(filters: AdvancedFilterValue): number {
  return [
    filters.symbol,
    filters.asset_type,
    filters.side,
    filters.holding,
    filters.pnl,
    filters.fees,
    filters.risk,
    filters.roi,
    filters.rating,
    filters.r_multiple,
    filters.session,
    filters.weekday,
    filters.setup_tag,
    filters.mood,
    filters.emotion,
    filters.journal,
    filters.rules,
  ].filter(Boolean).length;
}

export function filtersFromSearch(search: URLSearchParams): Partial<LocalFilters> {
  const status = search.get("status");
  const side = search.get("side");
  return {
    search: search.get("q") ?? undefined,
    dateFrom: search.get("date_from") ?? undefined,
    dateTo: search.get("date_to") ?? undefined,
    status: status === "open" || status === "closed" || status === "all" ? status : undefined,
    side: side === "long" || side === "short" ? side : undefined,
    setup_tag: search.get("setup_tag") ?? undefined,
    symbol: search.get("symbol") ?? undefined,
    session: search.get("session") ?? undefined,
    ids: search.get("ids") ?? undefined,
    auto_flag: search.get("auto_flag") ?? undefined,
    rules: search.get("has_rules_broken") === "true" ? "broken" : undefined,
  };
}

export function hasUrlInsightFilters(params: URLSearchParams): boolean {
  return [
    "setup_tag",
    "symbol",
    "session",
    "side",
    "date_from",
    "date_to",
    "ids",
    "auto_flag",
    "has_rules_broken",
  ].some((key) => Boolean(params.get(key)));
}

export function netRoiPct(trade: Trade, pnl: number | null): number | null {
  if (pnl == null) return null;
  const invested = Number(trade.invested_amount);
  if (invested > 0) return (pnl / invested) * 100;
  const qty = Number(trade.quantity);
  const entry = Number(trade.entry_price);
  const cost = qty > 0 && entry > 0 ? qty * entry : 0;
  if (cost <= 0) return null;
  return (pnl / cost) * 100;
}

function sameText(a: string | null | undefined, b: string): boolean {
  return (a ?? "").trim().toLowerCase() === b.trim().toLowerCase();
}

function holdingOf(trade: Trade): "intraday" | "multiday" {
  const opened = trade.opened_at.slice(0, 10);
  if (!trade.closed_at) {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return opened === today ? "intraday" : "multiday";
  }
  return opened === trade.closed_at.slice(0, 10) ? "intraday" : "multiday";
}

function weekdayOf(trade: Trade): WeekdayFilter {
  const raw = (trade.closed_at || trade.opened_at).slice(0, 10);
  const [year, month, day] = raw.split("-").map(Number);
  if (!year || !month || !day) return "";
  return String(new Date(year, month - 1, day).getDay()) as WeekdayFilter;
}

function isJournaled(trade: Trade): boolean {
  return Boolean(trade.notes?.trim()) || (trade.screenshot_urls?.length ?? 0) > 0;
}

function strategyMatches(trade: Trade, tag: string): boolean {
  const names = [trade.setup_tag, trade.strategy_name, ...(trade.setup_tags ?? [])];
  return names.some((name) => sameText(name, tag));
}

type DisplayPnl = (pnl: number | null | undefined, fees?: number | null) => number | null;

export function matchesTrade(
  trade: Trade,
  filters: LocalFilters,
  displayPnl: DisplayPnl,
  options?: { ignoreStatus?: boolean }
): boolean {
  if (!options?.ignoreStatus && filters.status !== "all" && trade.status !== filters.status) return false;
  if (filters.asset_type && trade.asset_type !== filters.asset_type) return false;
  if (filters.side && trade.side !== filters.side) return false;
  if (filters.symbol && !sameText(trade.symbol, filters.symbol)) return false;
  if (filters.session && !sameText(trade.session, filters.session)) return false;
  if (filters.setup_tag && !strategyMatches(trade, filters.setup_tag)) return false;
  if (filters.holding && holdingOf(trade) !== filters.holding) return false;
  if (filters.weekday && weekdayOf(trade) !== filters.weekday) return false;
  if (filters.mood && !moodsFromTrade(trade).some((mood) => sameText(mood, filters.mood))) return false;
  if (filters.emotion && !(trade.emotion_tags ?? []).some((tag) => sameText(tag, filters.emotion))) {
    return false;
  }

  const search = filters.search.trim().toLowerCase();
  if (search) {
    const hay = `${trade.symbol} ${trade.setup_tag ?? ""} ${trade.strategy_name ?? ""} ${trade.notes ?? ""}`.toLowerCase();
    if (!hay.includes(search)) return false;
  }

  const pnl = displayPnl(trade.pnl, trade.fees);
  if (filters.pnl === "profit" && !(pnl != null && pnl > 0)) return false;
  if (filters.pnl === "loss" && !(pnl != null && pnl < 0)) return false;
  if (filters.pnl === "breakeven" && !(pnl != null && pnl === 0)) return false;

  const roi = netRoiPct(trade, pnl);
  if (filters.roi === "positive" && !(roi != null && roi > 0)) return false;
  if (filters.roi === "negative" && !(roi != null && roi < 0)) return false;

  const fees = Number(trade.fees) || 0;
  if (filters.fees === "with" && fees <= 0) return false;
  if (filters.fees === "without" && fees > 0) return false;

  const risk = trade.risk_amount == null ? null : Number(trade.risk_amount);
  if (filters.risk === "with" && !(risk != null && risk > 0)) return false;
  if (filters.risk === "without" && risk != null && risk > 0) return false;

  const r = trade.r_multiple == null ? null : Number(trade.r_multiple);
  if (filters.r_multiple === "positive" && !(r != null && r > 0)) return false;
  if (filters.r_multiple === "negative" && !(r != null && r < 0)) return false;
  if (filters.r_multiple === "none" && r != null) return false;

  if (filters.rating === "unrated" && trade.rating != null) return false;
  if (filters.rating && filters.rating !== "unrated" && String(trade.rating ?? "") !== filters.rating) {
    return false;
  }

  const journaled = isJournaled(trade);
  if (filters.journal === "journaled" && !journaled) return false;
  if (filters.journal === "unjournaled" && journaled) return false;

  const broken = (trade.rules_broken?.length ?? 0) > 0;
  if (filters.rules === "broken" && !broken) return false;
  if (filters.rules === "clean" && broken) return false;

  return true;
}

export function uniqueLabels(values: Array<string | null | undefined>): string[] {
  const seen = new Map<string, string>();
  for (const raw of values) {
    const name = (raw ?? "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!seen.has(key)) seen.set(key, name);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}
