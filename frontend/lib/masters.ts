import type { MasterCategory } from "@/lib/types";

const CATEGORY_LABEL: Record<MasterCategory, string> = {
  symbol: "Symbols",
  entry_condition: "Entry conditions",
  exit_condition: "Exit conditions",
  timeframe: "Timeframes",
  session: "Sessions",
  trade_type: "Trade types",
  mood: "Mood",
  strategy: "Strategies",
  mistake: "Mistakes",
  went_well: "What went well",
};

export function masterCategoryLabel(category: MasterCategory): string {
  return CATEGORY_LABEL[category];
}

export function parseLabelList(value: unknown): string[] {
  if (Array.isArray(value)) {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const item of value) {
      const name = String(item).trim().replace(/\s+/g, " ");
      const key = name.toLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
    return out;
  }
  if (typeof value === "string" && value.trim()) {
    return parseLabelList(value.split(","));
  }
  return [];
}

export function moodsFromTrade(trade: { mood?: string | null; extra?: Record<string, unknown> | null }): string[] {
  const extra = trade.extra;
  if (extra && Object.prototype.hasOwnProperty.call(extra, "moods")) {
    return parseLabelList(extra.moods);
  }
  return parseLabelList(trade.mood);
}

export function masterNames(
  rows: { name: string; is_active?: boolean }[],
  selected: string[] = []
): string[] {
  const active = rows.filter((row) => row.is_active !== false).map((row) => row.name);
  const seen = new Set(active.map((name) => name.toLowerCase()));
  const extras: string[] = [];
  for (const raw of selected) {
    const name = raw.trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    extras.push(name);
  }
  return [...active, ...extras];
}

export function selectionSummary(value: string[], placeholder = "Select", noun?: string): string {
  if (!value.length) return placeholder;
  if (value.length === 1) return value[0];
  const unit = noun?.trim();
  const counted = unit ? `${value.length} ${unit} selected` : `${value.length} selected`;
  if (value.length >= 4) return counted;
  if (value.length === 2) {
    const pair = `${value[0]}, ${value[1]}`;
    return pair.length <= 36 ? pair : `${value[0]} +1`;
  }
  const withMore = `${value[0]}, ${value[1]} +${value.length - 2}`;
  return withMore.length <= 40 ? withMore : counted;
}
