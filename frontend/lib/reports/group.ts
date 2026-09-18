import { normalizeSymbol } from "@/lib/instruments/catalog";
import {
  DTE_BUCKETS,
  DURATION_BUCKETS,
  INSTRUMENT_LABELS,
  MONTHS,
  MONTHS_FULL,
  POSITION_SIZE_BUCKETS,
  PRICE_BUCKETS,
  R_BUCKETS,
  VOLUME_BUCKETS,
  WEEKDAY_FULL,
  WEEKDAYS,
  dteBucket,
  durationBucket,
  positionSizeBucket,
  priceBucket,
  rMultipleBucket,
  volumeBucket,
} from "@/lib/reports/buckets";
import type { DisplayPnlFn } from "@/lib/reports/types";
import type { Trade } from "@/lib/types";

export type GroupBucket = {
  key: string;
  label: string;
  fullLabel: string;
  order: number;
  trades: number;
  wins: number;
  losses: number;
  be: number;
  pnl: number;
  winRate: number;
};

export type GroupSummary = {
  best: GroupBucket | null;
  least: GroupBucket | null;
  mostActive: GroupBucket | null;
  bestWinRate: GroupBucket | null;
};

export type DimensionMetricId = "pnl" | "trade_count" | "win_rate" | "avg_pnl";

export const DIMENSION_METRICS: {
  id: DimensionMetricId;
  label: string;
  axis: "money" | "count" | "percent";
  chart: "signedArea" | "line" | "bar";
}[] = [
  { id: "pnl", label: "Net P&L", axis: "money", chart: "signedArea" },
  { id: "trade_count", label: "Trade count", axis: "count", chart: "line" },
  { id: "win_rate", label: "Win %", axis: "percent", chart: "bar" },
  { id: "avg_pnl", label: "Avg trade P&L", axis: "money", chart: "signedArea" },
];

export function dimensionMetricLabel(id: DimensionMetricId, pnlMode: "net" | "gross"): string {
  if (id === "pnl") return pnlMode === "gross" ? "Gross P&L" : "Net P&L";
  if (id === "avg_pnl") return pnlMode === "gross" ? "Avg gross P&L" : "Avg trade P&L";
  return DIMENSION_METRICS.find((m) => m.id === id)?.label ?? id;
}

function emptyGroup(key: string, label: string, order: number, fullLabel = label): GroupBucket {
  return { key, label, fullLabel, order, trades: 0, wins: 0, losses: 0, be: 0, pnl: 0, winRate: 0 };
}

function addClosed(group: GroupBucket, pnl: number) {
  group.trades += 1;
  group.pnl += pnl;
  if (pnl > 0) group.wins += 1;
  else if (pnl < 0) group.losses += 1;
  else group.be += 1;
}

function finalize(groups: GroupBucket[]): GroupBucket[] {
  return groups.map((g) => ({
    ...g,
    pnl: Number(g.pnl.toFixed(2)),
    winRate: g.trades > 0 ? Number(((g.wins / g.trades) * 100).toFixed(2)) : 0,
  }));
}

function zoned(iso: string, timeZone: string) {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const bag: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) {
    if (p.type !== "literal") bag[p.type] = p.value;
  }
  if (bag.hour === "24") bag.hour = "00";
  const weekday = WEEKDAYS.indexOf((bag.weekday as (typeof WEEKDAYS)[number]) ?? "Sun");
  const month = Math.max(0, Number(bag.month || "1") - 1);
  const hour = Number(bag.hour || "0");
  const minute = Number(bag.minute || "0");
  return {
    weekday: weekday < 0 ? 0 : weekday,
    month,
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
  };
}

function closedPnl(trade: Trade, displayPnl: DisplayPnlFn): number | null {
  if (trade.status !== "closed" || trade.pnl == null) return null;
  const v = displayPnl(trade.pnl, trade.fees);
  return v == null || !Number.isFinite(v) ? null : v;
}

function holdMinutes(trade: Trade): number | null {
  if (!trade.closed_at) return null;
  const start = new Date(trade.opened_at).getTime();
  const end = new Date(trade.closed_at).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return (end - start) / 60000;
}

function dteDays(trade: Trade): number | null {
  if (trade.asset_type !== "option" || !trade.expiry_date) return null;
  const open = new Date(trade.opened_at).getTime();
  const exp = new Date(`${trade.expiry_date}T12:00:00`).getTime();
  if (!Number.isFinite(open) || !Number.isFinite(exp)) return null;
  return Math.round((exp - open) / 86400000);
}

export function summarizeGroups(groups: GroupBucket[]): GroupSummary {
  const live = groups.filter((g) => g.trades > 0);
  if (!live.length) return { best: null, least: null, mostActive: null, bestWinRate: null };
  const byPnl = (a: GroupBucket, b: GroupBucket) => b.pnl - a.pnl || b.trades - a.trades || a.order - b.order;
  const byTrades = (a: GroupBucket, b: GroupBucket) => b.trades - a.trades || b.pnl - a.pnl || a.order - b.order;
  const byWr = (a: GroupBucket, b: GroupBucket) => b.winRate - a.winRate || b.trades - a.trades || a.order - b.order;
  return {
    best: [...live].sort(byPnl)[0],
    least: [...live].sort((a, b) => -byPnl(a, b))[0],
    mostActive: [...live].sort(byTrades)[0],
    bestWinRate: [...live].sort(byWr)[0],
  };
}

export function rankGroups(groups: GroupBucket[], limit: number): GroupBucket[] {
  return groups
    .filter((g) => g.trades > 0)
    .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl) || b.trades - a.trades || a.order - b.order)
    .slice(0, limit)
    .map((g, i) => ({ ...g, order: i }));
}

function seed(list: { key: string; label: string; fullLabel?: string; order: number }[]): Map<string, GroupBucket> {
  const map = new Map<string, GroupBucket>();
  for (const item of list) {
    map.set(item.key, emptyGroup(item.key, item.label, item.order, item.fullLabel ?? item.label));
  }
  return map;
}

function toList(map: Map<string, GroupBucket>, keepEmpty: boolean): GroupBucket[] {
  const list = finalize([...map.values()].sort((a, b) => a.order - b.order));
  return keepEmpty ? list : list.filter((g) => g.trades > 0);
}

export function groupByWeekday(
  trades: Trade[],
  displayPnl: DisplayPnlFn,
  timeZone: string
): GroupBucket[] {
  const map = seed(
    WEEKDAYS.map((label, i) => ({ key: String(i), label, fullLabel: WEEKDAY_FULL[i], order: i }))
  );
  for (const trade of trades) {
    const pnl = closedPnl(trade, displayPnl);
    if (pnl == null) continue;
    const { weekday } = zoned(trade.closed_at || trade.opened_at, timeZone);
    addClosed(map.get(String(weekday))!, pnl);
  }
  return toList(map, true);
}

export function groupByMonthOfYear(
  trades: Trade[],
  displayPnl: DisplayPnlFn,
  timeZone: string
): GroupBucket[] {
  const map = seed(
    MONTHS.map((label, i) => ({ key: String(i), label, fullLabel: MONTHS_FULL[i], order: i }))
  );
  for (const trade of trades) {
    const pnl = closedPnl(trade, displayPnl);
    if (pnl == null) continue;
    const { month } = zoned(trade.closed_at || trade.opened_at, timeZone);
    addClosed(map.get(String(month))!, pnl);
  }
  return toList(map, true);
}

export function groupByHour(
  trades: Trade[],
  displayPnl: DisplayPnlFn,
  timeZone: string,
  bucketMinutes: number,
  useExit: boolean
): GroupBucket[] {
  const step = bucketMinutes > 0 ? bucketMinutes : 60;
  const count = Math.floor((24 * 60) / step);
  const seeds = Array.from({ length: count }, (_, i) => {
    const mins = i * step;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const label = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    return { key: label, label, order: i };
  });
  const map = seed(seeds);
  for (const trade of trades) {
    const pnl = closedPnl(trade, displayPnl);
    if (pnl == null) continue;
    const iso = useExit ? trade.closed_at : trade.opened_at;
    if (!iso) continue;
    const { hour, minute } = zoned(iso, timeZone);
    const minutes = hour * 60 + minute;
    const idx = Math.min(count - 1, Math.floor(minutes / step));
    const key = seeds[idx].key;
    addClosed(map.get(key)!, pnl);
  }
  return toList(map, true);
}

export function groupByDuration(trades: Trade[], displayPnl: DisplayPnlFn): GroupBucket[] {
  const map = seed(DURATION_BUCKETS.map((b) => ({ key: b.key, label: b.label, order: b.order })));
  for (const trade of trades) {
    const pnl = closedPnl(trade, displayPnl);
    if (pnl == null) continue;
    const mins = holdMinutes(trade);
    if (mins == null) continue;
    const b = durationBucket(mins);
    addClosed(map.get(b.key)!, pnl);
  }
  return toList(map, true);
}

export function groupBySymbol(trades: Trade[], displayPnl: DisplayPnlFn): GroupBucket[] {
  const map = new Map<string, GroupBucket>();
  for (const trade of trades) {
    const pnl = closedPnl(trade, displayPnl);
    if (pnl == null) continue;
    const key = normalizeSymbol(trade.symbol) || trade.symbol || "—";
    const label = trade.symbol || key;
    if (!map.has(key)) map.set(key, emptyGroup(key, label, map.size));
    addClosed(map.get(key)!, pnl);
  }
  return toList(map, false);
}

export function groupByInstrument(trades: Trade[], displayPnl: DisplayPnlFn): GroupBucket[] {
  const order = ["stock", "option", "future", "forex", "crypto"];
  const map = seed(
    order.map((key, i) => ({ key, label: INSTRUMENT_LABELS[key] ?? key, order: i }))
  );
  for (const trade of trades) {
    const pnl = closedPnl(trade, displayPnl);
    if (pnl == null) continue;
    const key = trade.asset_type;
    if (!map.has(key)) map.set(key, emptyGroup(key, INSTRUMENT_LABELS[key] ?? key, map.size));
    addClosed(map.get(key)!, pnl);
  }
  return toList(map, true);
}

export function groupByPrice(trades: Trade[], displayPnl: DisplayPnlFn): GroupBucket[] {
  const map = seed(PRICE_BUCKETS.map((b) => ({ key: b.key, label: b.label, order: b.order })));
  for (const trade of trades) {
    const pnl = closedPnl(trade, displayPnl);
    if (pnl == null) continue;
    const b = priceBucket(Number(trade.entry_price));
    addClosed(map.get(b.key)!, pnl);
  }
  return toList(map, true);
}

export function groupByVolume(trades: Trade[], displayPnl: DisplayPnlFn): GroupBucket[] {
  const map = seed(VOLUME_BUCKETS.map((b) => ({ key: b.key, label: b.label, order: b.order })));
  for (const trade of trades) {
    const pnl = closedPnl(trade, displayPnl);
    if (pnl == null) continue;
    const b = volumeBucket(Number(trade.quantity));
    if (!map.has(b.key)) map.set(b.key, emptyGroup(b.key, b.label, b.order));
    addClosed(map.get(b.key)!, pnl);
  }
  return toList(map, true);
}

export function groupByPositionSize(trades: Trade[], displayPnl: DisplayPnlFn): GroupBucket[] {
  const map = seed(POSITION_SIZE_BUCKETS.map((b) => ({ key: b.key, label: b.label, order: b.order })));
  for (const trade of trades) {
    const pnl = closedPnl(trade, displayPnl);
    if (pnl == null) continue;
    const size =
      trade.position_value != null && Number.isFinite(Number(trade.position_value))
        ? Number(trade.position_value)
        : Number(trade.quantity) * Number(trade.entry_price);
    const b = positionSizeBucket(size);
    addClosed(map.get(b.key)!, pnl);
  }
  return toList(map, true);
}

export function groupByRMultiple(trades: Trade[], displayPnl: DisplayPnlFn): GroupBucket[] {
  const map = seed(R_BUCKETS.map((b) => ({ key: b.key, label: b.label, order: b.order })));
  for (const trade of trades) {
    const pnl = closedPnl(trade, displayPnl);
    if (pnl == null || trade.r_multiple == null) continue;
    const b = rMultipleBucket(Number(trade.r_multiple));
    addClosed(map.get(b.key)!, pnl);
  }
  return toList(map, true);
}

export function groupByPlaybook(trades: Trade[], displayPnl: DisplayPnlFn): GroupBucket[] {
  const map = new Map<string, GroupBucket>();
  const unassigned = emptyGroup("unassigned", "Unassigned", 999);
  map.set("unassigned", unassigned);
  for (const trade of trades) {
    const pnl = closedPnl(trade, displayPnl);
    if (pnl == null) continue;
    const name = (trade.strategy_name || trade.setup_tag || "").trim();
    if (!name) {
      addClosed(unassigned, pnl);
      continue;
    }
    const key = name.toLowerCase();
    if (!map.has(key)) map.set(key, emptyGroup(key, name, map.size));
    addClosed(map.get(key)!, pnl);
  }
  return toList(map, false);
}

export function groupByTag(trades: Trade[], displayPnl: DisplayPnlFn): GroupBucket[] {
  const map = new Map<string, GroupBucket>();
  for (const trade of trades) {
    const pnl = closedPnl(trade, displayPnl);
    if (pnl == null) continue;
    const tags = Array.from(
      new Set(
        [trade.setup_tag, ...(trade.setup_tags ?? [])]
          .map((t) => (t || "").trim())
          .filter(Boolean)
      )
    );
    if (!tags.length) continue;
    for (const tag of tags) {
      const key = tag.toLowerCase();
      if (!map.has(key)) map.set(key, emptyGroup(key, tag, map.size));
      addClosed(map.get(key)!, pnl);
    }
  }
  return toList(map, false);
}

export function groupByDte(trades: Trade[], displayPnl: DisplayPnlFn): GroupBucket[] {
  const map = seed(DTE_BUCKETS.map((b) => ({ key: b.key, label: b.label, order: b.order })));
  for (const trade of trades) {
    const pnl = closedPnl(trade, displayPnl);
    if (pnl == null) continue;
    const days = dteDays(trade);
    if (days == null) continue;
    const b = dteBucket(days);
    addClosed(map.get(b.key)!, pnl);
  }
  return toList(map, true);
}

export function groupByOutcome(trades: Trade[], displayPnl: DisplayPnlFn): GroupBucket[] {
  const map = seed([
    { key: "win", label: "Wins", order: 0 },
    { key: "loss", label: "Losses", order: 1 },
    { key: "be", label: "Break even", order: 2 },
  ]);
  for (const trade of trades) {
    const pnl = closedPnl(trade, displayPnl);
    if (pnl == null) continue;
    const key = pnl > 0 ? "win" : pnl < 0 ? "loss" : "be";
    addClosed(map.get(key)!, pnl);
  }
  return toList(map, true);
}

export function metricValue(group: GroupBucket, metric: DimensionMetricId): number | null {
  if (metric === "pnl") return group.pnl;
  if (metric === "trade_count") return group.trades;
  if (metric === "win_rate") return group.trades > 0 ? group.winRate : null;
  return group.trades ? group.pnl / group.trades : null;
}

export type DimensionKind =
  | "weekday"
  | "month"
  | "hour"
  | "duration"
  | "symbol"
  | "instrument"
  | "price"
  | "volume"
  | "position"
  | "r"
  | "playbook"
  | "tag"
  | "dte"
  | "outcome";

export function groupByDimension(
  kind: DimensionKind,
  trades: Trade[],
  displayPnl: DisplayPnlFn,
  opts: { timeZone: string; bucketMinutes?: number; useExit?: boolean }
): GroupBucket[] {
  switch (kind) {
    case "weekday":
      return groupByWeekday(trades, displayPnl, opts.timeZone);
    case "month":
      return groupByMonthOfYear(trades, displayPnl, opts.timeZone);
    case "hour":
      return groupByHour(trades, displayPnl, opts.timeZone, opts.bucketMinutes ?? 60, !!opts.useExit);
    case "duration":
      return groupByDuration(trades, displayPnl);
    case "symbol":
      return groupBySymbol(trades, displayPnl);
    case "instrument":
      return groupByInstrument(trades, displayPnl);
    case "price":
      return groupByPrice(trades, displayPnl);
    case "volume":
      return groupByVolume(trades, displayPnl);
    case "position":
      return groupByPositionSize(trades, displayPnl);
    case "r":
      return groupByRMultiple(trades, displayPnl);
    case "playbook":
      return groupByPlaybook(trades, displayPnl);
    case "tag":
      return groupByTag(trades, displayPnl);
    case "dte":
      return groupByDte(trades, displayPnl);
    case "outcome":
      return groupByOutcome(trades, displayPnl);
    default:
      return [];
  }
}

export type OutcomeStats = {
  wins: number;
  losses: number;
  be: number;
  winPnl: number;
  lossPnl: number;
  winRate: number;
  avgWin: number | null;
  avgLoss: number | null;
  largestWin: number | null;
  largestLoss: number | null;
  profitFactor: number | null;
};

export function outcomeStats(trades: Trade[], displayPnl: DisplayPnlFn): OutcomeStats {
  let wins = 0;
  let losses = 0;
  let be = 0;
  let winPnl = 0;
  let lossPnl = 0;
  let largestWin: number | null = null;
  let largestLoss: number | null = null;
  for (const trade of trades) {
    const pnl = closedPnl(trade, displayPnl);
    if (pnl == null) continue;
    if (pnl > 0) {
      wins += 1;
      winPnl += pnl;
      if (largestWin == null || pnl > largestWin) largestWin = pnl;
    } else if (pnl < 0) {
      losses += 1;
      lossPnl += pnl;
      if (largestLoss == null || pnl < largestLoss) largestLoss = pnl;
    } else {
      be += 1;
    }
  }
  const closed = wins + losses + be;
  return {
    wins,
    losses,
    be,
    winPnl: Number(winPnl.toFixed(2)),
    lossPnl: Number(lossPnl.toFixed(2)),
    winRate: closed > 0 ? Number(((wins / closed) * 100).toFixed(2)) : 0,
    avgWin: wins ? Number((winPnl / wins).toFixed(2)) : null,
    avgLoss: losses ? Number((lossPnl / losses).toFixed(2)) : null,
    largestWin,
    largestLoss,
    profitFactor: lossPnl < 0 ? Number((winPnl / Math.abs(lossPnl)).toFixed(2)) : wins ? null : 0,
  };
}
