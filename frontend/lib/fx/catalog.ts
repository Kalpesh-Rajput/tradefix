import { CURRENCY_ALIASES, FALLBACK_CURRENCIES, type FxCurrency } from "./types";

export function isValidCode(code: string): boolean {
  return /^[A-Za-z]{3}$/.test(code.trim());
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export function currencyByCode(list: FxCurrency[], code: string): FxCurrency | undefined {
  const upper = normalizeCode(code);
  return list.find((item) => item.code === upper);
}

export function mergeCurrencies(remote: FxCurrency[] | undefined): FxCurrency[] {
  const byCode = new Map<string, FxCurrency>();
  for (const item of FALLBACK_CURRENCIES) byCode.set(item.code, item);
  for (const item of remote ?? []) {
    const existing = byCode.get(item.code);
    byCode.set(item.code, existing ? { ...existing, ...item } : item);
  }
  return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
}

export function searchCurrencies(list: FxCurrency[], query: string): FxCurrency[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((item) => {
    const aliases = CURRENCY_ALIASES[item.code] ?? [];
    const haystack = [item.code, item.name, item.symbol, item.flag, ...aliases].join(" ").toLowerCase();
    return haystack.includes(q);
  });
}

export function swapPair(base: string, quote: string): { base: string; quote: string } {
  return { base: normalizeCode(quote), quote: normalizeCode(base) };
}

export function presetLabel(value: number): string {
  if (value >= 1000 && value % 1000 === 0) return `${value / 1000}K`;
  return String(value);
}
