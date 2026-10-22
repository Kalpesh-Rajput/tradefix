import {
  DEFAULT_NEWS_FILTERS,
  NEWS_CATEGORIES,
  type NewsArticle,
  type NewsCategory,
  type NewsFilterState,
  type NewsFreshness,
} from "./types";

export function isSafeExternalUrl(rawUrl: string | null | undefined): boolean {
  if (!rawUrl || typeof rawUrl !== "string") return false;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 2048) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    if (!parsed.hostname || !parsed.hostname.includes(".")) return false;
    return true;
  } catch {
    return false;
  }
}

export function buildNewsQueryString(
  filters: NewsFilterState,
  page = 1,
  pageSize = 20,
  refresh = false
): string {
  const params = new URLSearchParams();
  params.set("category", filters.category || "all");
  if (filters.query.trim()) params.set("query", filters.query.trim().slice(0, 120));
  if (filters.symbol.trim()) params.set("symbol", filters.symbol.trim().slice(0, 24));
  if (filters.source.trim()) params.set("source", filters.source.trim().slice(0, 120));
  if (filters.sentiment) params.set("sentiment", filters.sentiment);
  if (filters.dateRange && filters.dateRange !== "all") params.set("date_range", filters.dateRange);
  if (filters.sort && filters.sort !== "newest") params.set("sort", filters.sort);
  params.set("page", String(Math.max(1, page)));
  params.set("page_size", String(Math.min(50, Math.max(1, pageSize))));
  if (refresh) params.set("refresh", "true");
  return params.toString();
}

export function hasActiveRefinements(filters: NewsFilterState): boolean {
  return (
    filters.query.trim() !== DEFAULT_NEWS_FILTERS.query ||
    filters.symbol.trim() !== DEFAULT_NEWS_FILTERS.symbol ||
    filters.source.trim() !== DEFAULT_NEWS_FILTERS.source ||
    filters.sentiment !== DEFAULT_NEWS_FILTERS.sentiment ||
    filters.dateRange !== DEFAULT_NEWS_FILTERS.dateRange ||
    filters.sort !== DEFAULT_NEWS_FILTERS.sort
  );
}

export function categoryLabel(category: NewsCategory | string): string {
  const match = NEWS_CATEGORIES.find((c) => c.id === category);
  return match ? match.label : "Market News";
}

export function formatNewsRelativeTime(isoTimestamp: string, now: Date = new Date()): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return "Recently";
  const diffSec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (diffSec < 45) return "Just now";
  if (diffSec < 3600) {
    const mins = Math.max(1, Math.floor(diffSec / 60));
    return `${mins}m ago`;
  }
  if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600);
    return `${hours}h ago`;
  }
  const days = Math.floor(diffSec / 86400);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatNewsExactTimestamp(isoTimestamp: string, timeZone?: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timeZone || undefined,
      timeZoneName: "short",
    }).format(date);
  } catch {
    return date.toISOString().replace("T", " ").slice(0, 16) + " UTC";
  }
}

export function newsFreshnessBadge(freshness: NewsFreshness): {
  label: string;
  tone: "latest" | "cached" | "stale";
} {
  if (freshness === "latest") {
    return { label: "Updated", tone: "latest" };
  }
  if (freshness === "stale") {
    return { label: "Cached fallback", tone: "stale" };
  }
  return { label: "Cached feed", tone: "cached" };
}

export function mergePaginatedArticles(existing: NewsArticle[], incoming: NewsArticle[]): NewsArticle[] {
  const seen = new Set<string>();
  const merged: NewsArticle[] = [];
  for (const item of [...existing, ...incoming]) {
    if (!item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
}
