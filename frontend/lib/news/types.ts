export type NewsCategory =
  | "all"
  | "forex"
  | "central_banks"
  | "economy"
  | "crypto"
  | "stocks"
  | "indices"
  | "commodities";

export type NewsSentiment = "positive" | "negative" | "neutral";
export type NewsSymbolsSource = "provider" | "contextual" | "none";
export type NewsFreshness = "latest" | "cached" | "stale";
export type NewsDateRange = "all" | "24h" | "7d" | "30d";
export type NewsSort = "newest" | "relevance";

export interface ProviderHealthStatus {
  provider: string;
  enabled: boolean;
  healthy: boolean;
  status: "ok" | "cached" | "rate_limited" | "quota_exhausted" | "error" | "disabled" | "unconfigured";
  article_count: number;
  detail?: string | null;
}

export interface NewsArticle {
  id: string;
  title: string;
  summary?: string | null;
  source: string;
  source_domain?: string | null;
  url: string;
  published_at: string;
  category: NewsCategory;
  symbols: string[];
  symbols_source: NewsSymbolsSource;
  sentiment?: NewsSentiment | null;
  sentiment_score?: number | null;
  image_url?: string | null;
  language: string;
  provider: string;
  relevance_score: number;
  is_bookmarked: boolean;
  saved_at?: string | null;
}

export interface NewsFeedMeta {
  candidate_count: number;
  page: number;
  page_size: number;
  has_more: boolean;
  fetched_at: string;
  freshness: NewsFreshness;
  cache_ttl_seconds: number;
  active_providers: string[];
  provider_status: ProviderHealthStatus[];
  sentiment_available: boolean;
  available_sources: string[];
  watchlist_symbols: string[];
}

export interface NewsFeedResponse {
  featured: NewsArticle | null;
  articles: NewsArticle[];
  meta: NewsFeedMeta;
}

export interface NewsFilterState {
  category: NewsCategory;
  query: string;
  symbol: string;
  source: string;
  sentiment: "" | NewsSentiment;
  dateRange: NewsDateRange;
  sort: NewsSort;
}

export const DEFAULT_NEWS_FILTERS: NewsFilterState = {
  category: "all",
  query: "",
  symbol: "",
  source: "",
  sentiment: "",
  dateRange: "all",
  sort: "newest",
};

export const NEWS_CATEGORIES: readonly { id: NewsCategory; label: string; shortLabel: string }[] = [
  { id: "all", label: "All News", shortLabel: "All" },
  { id: "forex", label: "Forex", shortLabel: "Forex" },
  { id: "central_banks", label: "Central Banks", shortLabel: "Central Banks" },
  { id: "economy", label: "Economy", shortLabel: "Economy" },
  { id: "crypto", label: "Crypto", shortLabel: "Crypto" },
  { id: "stocks", label: "Stocks", shortLabel: "Stocks" },
  { id: "indices", label: "Indices", shortLabel: "Indices" },
  { id: "commodities", label: "Commodities", shortLabel: "Commodities" },
] as const;

export const QUICK_INSTRUMENT_CHIPS: readonly string[] = [
  "EUR/USD",
  "GBP/USD",
  "USD/JPY",
  "XAU/USD",
  "BTC/USD",
  "ETH/USD",
  "SPY",
  "QQQ",
  "NVDA",
  "CL",
] as const;
