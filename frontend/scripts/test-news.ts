/**
 * Financial News Terminal frontend unit tests (URL safety, query building, formatting, pagination merge).
 * Run: npx --yes tsx scripts/test-news.ts
 */
import {
  buildNewsQueryString,
  categoryLabel,
  formatNewsExactTimestamp,
  formatNewsRelativeTime,
  hasActiveRefinements,
  isSafeExternalUrl,
  mergePaginatedArticles,
  newsFreshnessBadge,
} from "../lib/news/format";
import { DEFAULT_NEWS_FILTERS, type NewsArticle } from "../lib/news/types";

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(`FAIL: ${msg}`);
}

function assertEq(actual: unknown, expected: unknown, msg: string) {
  assert(
    actual === expected,
    `${msg} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`
  );
}

// 1. Safe external URL checks
assertEq(isSafeExternalUrl("https://www.reuters.com/markets/fx"), true, "valid https URL");
assertEq(isSafeExternalUrl("http://bloomberg.com/news"), true, "valid http URL");
assertEq(isSafeExternalUrl("javascript:alert(1)"), false, "reject javascript: scheme");
assertEq(isSafeExternalUrl("data:text/html,<h1>hi</h1>"), false, "reject data: scheme");
assertEq(isSafeExternalUrl(""), false, "reject empty URL");
assertEq(isSafeExternalUrl(null), false, "reject null URL");

// 2. Query string builder
const defaultQs = buildNewsQueryString(DEFAULT_NEWS_FILTERS, 1, 20, false);
assertEq(defaultQs, "category=all&page=1&page_size=20", "default query string");

const customQs = buildNewsQueryString(
  {
    category: "forex",
    query: "ECB Lagarde",
    symbol: "EUR/USD",
    source: "Reuters",
    sentiment: "positive",
    dateRange: "24h",
    sort: "relevance",
  },
  2,
  15,
  true
);
assert(customQs.includes("category=forex"), "includes category");
assert(customQs.includes("query=ECB+Lagarde"), "includes query");
assert(customQs.includes("symbol=EUR%2FUSD"), "includes encoded symbol");
assert(customQs.includes("sentiment=positive"), "includes sentiment");
assert(customQs.includes("date_range=24h"), "includes date_range");
assert(customQs.includes("sort=relevance"), "includes sort");
assert(customQs.includes("refresh=true"), "includes refresh");

// 3. Active refinement detection
assertEq(hasActiveRefinements(DEFAULT_NEWS_FILTERS), false, "default filters have no refinements");
assertEq(
  hasActiveRefinements({ ...DEFAULT_NEWS_FILTERS, category: "crypto" }),
  false,
  "category alone is not a toolbar refinement"
);
assertEq(
  hasActiveRefinements({ ...DEFAULT_NEWS_FILTERS, symbol: "BTC/USD" }),
  true,
  "symbol counts as active refinement"
);

// 4. Relative & exact timestamps
const refNow = new Date("2026-10-22T12:00:00Z");
assertEq(
  formatNewsRelativeTime("2026-10-22T11:59:30Z", refNow),
  "Just now",
  "relative <45s"
);
assertEq(
  formatNewsRelativeTime("2026-10-22T11:45:00Z", refNow),
  "15m ago",
  "relative 15m"
);
assertEq(
  formatNewsRelativeTime("2026-10-22T09:00:00Z", refNow),
  "3h ago",
  "relative 3h"
);
const exact = formatNewsExactTimestamp("2026-10-22T10:30:00Z", "UTC");
assert(exact.includes("Oct") && exact.includes("2026"), "exact timestamp formatted");

// 5. Freshness badge & category labels
assertEq(newsFreshnessBadge("latest").tone, "latest", "latest badge");
assertEq(newsFreshnessBadge("stale").tone, "stale", "stale badge");
assertEq(categoryLabel("central_banks"), "Central Banks", "central banks label");

// 6. Pagination merge deduplication
const sampleA: NewsArticle = {
  id: "art-1",
  title: "Headline 1",
  source: "Reuters",
  url: "https://reuters.com/1",
  published_at: "2026-10-22T10:00:00Z",
  category: "forex",
  symbols: ["EUR/USD"],
  symbols_source: "contextual",
  language: "en",
  provider: "google_rss",
  relevance_score: 2,
  is_bookmarked: false,
};
const sampleB: NewsArticle = { ...sampleA, id: "art-2", title: "Headline 2" };
const merged = mergePaginatedArticles([sampleA], [sampleA, sampleB]);
assertEq(merged.length, 2, "mergePaginatedArticles prevents duplicates across Load More pages");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
