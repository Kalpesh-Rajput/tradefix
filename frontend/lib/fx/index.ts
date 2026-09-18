const KEY = "tradefix.fxConverter";

export type FxConverterPrefs = {
  base: string;
  quote: string;
  amount: number;
};

const DEFAULTS: FxConverterPrefs = { base: "USD", quote: "INR", amount: 1000 };

export function readFxConverterPrefs(): FxConverterPrefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<FxConverterPrefs>;
    const base = typeof parsed.base === "string" && /^[A-Z]{3}$/.test(parsed.base) ? parsed.base : DEFAULTS.base;
    const quote = typeof parsed.quote === "string" && /^[A-Z]{3}$/.test(parsed.quote) ? parsed.quote : DEFAULTS.quote;
    const amount =
      typeof parsed.amount === "number" && Number.isFinite(parsed.amount) && parsed.amount >= 0
        ? parsed.amount
        : DEFAULTS.amount;
    return { base, quote, amount };
  } catch {
    return DEFAULTS;
  }
}

export function writeFxConverterPrefs(prefs: FxConverterPrefs): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(prefs));
}
