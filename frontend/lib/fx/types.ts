export type FxFreshness = "latest" | "cached" | "stale";

export type FxQuote = {
  base: string;
  quote: string;
  rate: number;
  rate_timestamp: string | null;
  fetched_at: string;
  source: string;
  source_attribution: string;
  delayed: boolean;
  freshness: FxFreshness;
  cache_ttl_seconds: number;
};

export type FxCurrency = {
  code: string;
  name: string;
  symbol: string;
  flag: string;
  decimals: number;
};

export type FxCurrencyList = {
  currencies: FxCurrency[];
  source: string;
  delayed: boolean;
};

export const POPULAR_PAIRS: [string, string][] = [
  ["USD", "INR"],
  ["EUR", "USD"],
  ["GBP", "USD"],
  ["USD", "JPY"],
  ["AUD", "USD"],
  ["USD", "CAD"],
];

export const AMOUNT_PRESETS = [100, 500, 1000, 5000, 10000] as const;

export const FALLBACK_CURRENCIES: FxCurrency[] = [
  { code: "USD", name: "US Dollar", symbol: "$", flag: "US", decimals: 2 },
  { code: "EUR", name: "Euro", symbol: "€", flag: "EU", decimals: 2 },
  { code: "GBP", name: "British Pound", symbol: "£", flag: "GB", decimals: 2 },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", flag: "JP", decimals: 0 },
  { code: "INR", name: "Indian Rupee", symbol: "₹", flag: "IN", decimals: 2 },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", flag: "AU", decimals: 2 },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", flag: "CA", decimals: 2 },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", flag: "CH", decimals: 2 },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", flag: "SG", decimals: 2 },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ", flag: "AE", decimals: 2 },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", flag: "CN", decimals: 2 },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", flag: "HK", decimals: 2 },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", flag: "NZ", decimals: 2 },
  { code: "KRW", name: "South Korean Won", symbol: "₩", flag: "KR", decimals: 0 },
  { code: "BRL", name: "Brazilian Real", symbol: "R$", flag: "BR", decimals: 2 },
  { code: "MXN", name: "Mexican Peso", symbol: "MX$", flag: "MX", decimals: 2 },
  { code: "ZAR", name: "South African Rand", symbol: "R", flag: "ZA", decimals: 2 },
  { code: "SEK", name: "Swedish Krona", symbol: "kr", flag: "SE", decimals: 2 },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr", flag: "NO", decimals: 2 },
  { code: "DKK", name: "Danish Krone", symbol: "kr", flag: "DK", decimals: 2 },
  { code: "PLN", name: "Polish Zloty", symbol: "zł", flag: "PL", decimals: 2 },
  { code: "TRY", name: "Turkish Lira", symbol: "₺", flag: "TR", decimals: 2 },
  { code: "THB", name: "Thai Baht", symbol: "฿", flag: "TH", decimals: 2 },
];

export const CURRENCY_ALIASES: Record<string, string[]> = {
  USD: ["united states", "dollar", "buck", "$"],
  EUR: ["eurozone", "europe", "€"],
  GBP: ["united kingdom", "sterling", "pound", "£"],
  JPY: ["japan", "yen", "¥"],
  INR: ["india", "rupee", "₹"],
  AUD: ["australia"],
  CAD: ["canada"],
  CHF: ["switzerland", "swiss"],
  SGD: ["singapore"],
  AED: ["uae", "emirates", "dirham", "dubai"],
};
