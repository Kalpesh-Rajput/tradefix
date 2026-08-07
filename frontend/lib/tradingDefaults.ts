import type { User } from "@/lib/types";

export const BUILTIN_STRATEGIES = [
  "Breakout",
  "Trend Following",
  "Mean Reversion",
  "Scalping",
  "Swing Trade",
  "Momentum",
  "Gap Fill",
  "Support/Resistance",
  "News/Catalyst",
  "Earnings Play",
  "Options Spread",
  "Reversal",
] as const;

export const BUILTIN_MISTAKES = [
  "Broke Rules",
  "FOMO Entry",
  "Revenge Trading",
  "Overtrading",
  "Ignored Stop Loss",
  "Moved Stop Loss",
  "Position Too Large",
  "Exited Too Early",
  "Exited Too Late",
  "Chased Entry",
  "No Trading Plan",
  "Emotional Decision",
  "Poor Risk/Reward",
  "Wrong Timeframe",
  "Ignored Signals",
] as const;

export type TradingDefaultsSlice = Pick<
  User,
  | "default_symbol"
  | "default_quantity"
  | "default_fee"
  | "default_forex_leverage"
  | "default_strategies"
  | "custom_strategies"
  | "strategy_order"
  | "custom_mistakes"
  | "mistake_order"
>;

function orderCatalog(items: string[], order: string[] | null | undefined): string[] {
  if (!order?.length) return items;
  const set = new Set(items);
  const ordered = order.filter((item) => set.has(item));
  const remaining = items.filter((item) => !ordered.includes(item));
  return [...ordered, ...remaining];
}

export function resolveStrategyCatalog(
  user?: Pick<User, "custom_strategies" | "strategy_order"> | null
): string[] {
  const builtin = [...BUILTIN_STRATEGIES];
  const custom = (user?.custom_strategies ?? []).filter(
    (item) => !builtin.some((b) => b.toLowerCase() === item.toLowerCase())
  );
  return orderCatalog([...builtin, ...custom], user?.strategy_order);
}

export function resolveMistakeCatalog(
  user?: Pick<User, "custom_mistakes" | "mistake_order"> | null
): string[] {
  const builtin = [...BUILTIN_MISTAKES];
  const custom = (user?.custom_mistakes ?? []).filter(
    (item) => !builtin.some((b) => b.toLowerCase() === item.toLowerCase())
  );
  return orderCatalog([...builtin, ...custom], user?.mistake_order);
}

export function isBuiltinStrategy(label: string): boolean {
  return BUILTIN_STRATEGIES.some((item) => item.toLowerCase() === label.toLowerCase());
}

export function isBuiltinMistake(label: string): boolean {
  return BUILTIN_MISTAKES.some((item) => item.toLowerCase() === label.toLowerCase());
}

export function normalizeLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}
