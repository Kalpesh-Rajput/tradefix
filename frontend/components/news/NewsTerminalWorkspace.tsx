"use client";

import clsx from "clsx";
import {
  AlertCircle,
  AlertTriangle,
  Bookmark,
  Newspaper,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { HeaderActions } from "@/components/layout/HeaderActions";
import { FeaturedStoryCard } from "@/components/news/FeaturedStoryCard";
import { NewsArticleCard } from "@/components/news/NewsArticleCard";
import { NewsCategoryTabs } from "@/components/news/NewsCategoryTabs";
import { NewsFilterToolbar } from "@/components/news/NewsFilterToolbar";
import { useAuth } from "@/components/providers/AuthProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api";
import {
  useNewsBookmarks,
  useNewsFeed,
  useToggleNewsBookmark,
} from "@/lib/hooks/useNews";
import {
  formatNewsExactTimestamp,
  formatNewsRelativeTime,
  hasActiveRefinements,
  mergePaginatedArticles,
  newsFreshnessBadge,
} from "@/lib/news/format";
import {
  DEFAULT_NEWS_FILTERS,
  type NewsArticle,
  type NewsCategory,
  type NewsFilterState,
} from "@/lib/news/types";

const PAGE_SIZE = 20;

export function NewsTerminalWorkspace() {
  const { user } = useAuth();
  const { toast, error: toastError, success: toastSuccess } = useToast();
  const userTimezone = user?.timezone || undefined;

  const [filters, setFilters] = useState<NewsFilterState>(DEFAULT_NEWS_FILTERS);
  const [page, setPage] = useState(1);
  const [accumulatedArticles, setAccumulatedArticles] = useState<NewsArticle[]>([]);
  const [savedView, setSavedView] = useState(false);

  const feed = useNewsFeed(filters, page, PAGE_SIZE);
  const bookmarksQuery = useNewsBookmarks();
  const toggleBookmark = useToggleNewsBookmark();

  const bookmarkedIds = useMemo(
    () => new Set((bookmarksQuery.data ?? []).map((b) => b.id)),
    [bookmarksQuery.data]
  );

  useEffect(() => {
    if (!feed.data) return;
    if (page === 1) {
      setAccumulatedArticles(feed.data.articles);
    } else {
      setAccumulatedArticles((prev) => mergePaginatedArticles(prev, feed.data!.articles));
    }
  }, [feed.data, page]);

  const updateFilters = useCallback((patch: Partial<NewsFilterState>) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const clearRefinements = useCallback(() => {
    setPage(1);
    setFilters((prev) => ({
      ...DEFAULT_NEWS_FILTERS,
      category: prev.category,
    }));
  }, []);

  const resetAllFilters = useCallback(() => {
    setPage(1);
    setFilters(DEFAULT_NEWS_FILTERS);
  }, []);

  const handleSelectCategory = useCallback((category: NewsCategory) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, category }));
  }, []);

  const handleSelectSymbol = useCallback((symbol: string) => {
    setPage(1);
    setSavedView(false);
    setFilters((prev) => ({
      ...prev,
      symbol: prev.symbol.toUpperCase() === symbol.toUpperCase() ? "" : symbol,
    }));
  }, []);

  const handleRefresh = useCallback(async () => {
    try {
      setPage(1);
      await feed.refresh();
      toastSuccess("Market news refreshed");
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Unable to refresh market news right now.";
      toastError("Refresh failed", msg);
    }
  }, [feed, toastError, toastSuccess]);

  const handleToggleBookmark = useCallback(
    async (article: NewsArticle) => {
      try {
        const res = await toggleBookmark.mutateAsync({
          ...article,
          is_bookmarked: bookmarkedIds.has(article.id),
        });
        toast({
          title: res.action === "saved" ? "Story saved to bookmarks" : "Removed from saved stories",
          variant: "info",
        });
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : "Could not update bookmark.";
        toastError("Bookmark error", msg);
      }
    },
    [bookmarkedIds, toast, toastError, toggleBookmark]
  );

  const meta = feed.data?.meta;
  const featured = useMemo(() => {
    if (!feed.data?.featured || savedView) return null;
    return {
      ...feed.data.featured,
      is_bookmarked: bookmarkedIds.has(feed.data.featured.id),
    };
  }, [feed.data?.featured, savedView, bookmarkedIds]);

  const displayedArticles = useMemo(() => {
    if (savedView) {
      return (bookmarksQuery.data ?? []).map((item) => ({
        ...item,
        is_bookmarked: true,
      }));
    }
    const baseList = accumulatedArticles.length > 0 ? accumulatedArticles : (feed.data?.articles ?? []);
    return baseList
      .filter((a) => !featured || a.id !== featured.id)
      .map((a) => ({
        ...a,
        is_bookmarked: bookmarkedIds.has(a.id),
      }));
  }, [savedView, bookmarksQuery.data, accumulatedArticles, feed.data?.articles, featured, bookmarkedIds]);

  const freshnessInfo = meta ? newsFreshnessBadge(meta.freshness) : null;
  const partialProviderDegraded = useMemo(() => {
    if (!meta?.provider_status) return false;
    const enabled = meta.provider_status.filter((p) => p.enabled);
    return enabled.some((p) => !p.healthy) && enabled.some((p) => p.healthy);
  }, [meta?.provider_status]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[var(--color-background)]">
      <HeaderActions subtitle="Follow Forex, crypto, equity, commodity, and central-bank developments.">
        <div className="flex flex-wrap items-center gap-2">
          {meta && freshnessInfo && (
            <span
              className={clsx(
                "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium",
                freshnessInfo.tone === "stale"
                  ? "border-[var(--color-warning)] bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]"
              )}
              title={`Last synced: ${formatNewsExactTimestamp(meta.fetched_at, userTimezone)}`}
              data-testid="news-freshness-pill"
            >
              <span
                className={clsx(
                  "h-1.5 w-1.5 rounded-full",
                  freshnessInfo.tone === "latest" && "bg-[var(--color-success-text)]",
                  freshnessInfo.tone === "cached" && "bg-[var(--color-primary)]",
                  freshnessInfo.tone === "stale" && "bg-[var(--color-warning)]"
                )}
                aria-hidden
              />
              <span>{freshnessInfo.label}</span>
              <span className="text-[var(--color-text-tertiary)]">
                · {formatNewsRelativeTime(meta.fetched_at)}
              </span>
            </span>
          )}

          <button
            type="button"
            onClick={handleRefresh}
            disabled={feed.isRefreshing || feed.isLoading}
            data-testid="news-refresh-button"
            className="dash-btn-secondary h-8 px-3 text-[12px]"
          >
            <RefreshCw
              className={clsx("h-3.5 w-3.5", (feed.isRefreshing || feed.isFetching) && "tf-spinner")}
              aria-hidden
            />
            <span>{feed.isRefreshing ? "Refreshing…" : "Refresh"}</span>
          </button>
        </div>
      </HeaderActions>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-3 px-4 py-3.5 sm:px-5">
          <NewsCategoryTabs
            activeCategory={filters.category}
            activeSymbol={filters.symbol}
            watchlistSymbols={meta?.watchlist_symbols ?? []}
            savedView={savedView}
            savedCount={bookmarksQuery.data?.length ?? 0}
            onSelectCategory={handleSelectCategory}
            onSelectSymbol={handleSelectSymbol}
            onToggleSavedView={setSavedView}
          />

          {!savedView && (
            <NewsFilterToolbar
              filters={filters}
              availableSources={meta?.available_sources ?? []}
              sentimentAvailable={Boolean(meta?.sentiment_available)}
              totalMatched={meta?.candidate_count ?? 0}
              onUpdateFilters={updateFilters}
              onClearFilters={clearRefinements}
            />
          )}

          {!savedView && meta?.freshness === "stale" && (
            <div
              role="status"
              data-testid="news-stale-banner"
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-warning)] bg-[var(--color-warning-bg)] px-3.5 py-2.5 text-[12px] text-[var(--color-warning-text)]"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                <span>
                  Upstream news providers are temporarily unreachable or rate-limited. Showing cached stories from{" "}
                  <strong>{formatNewsExactTimestamp(meta.fetched_at, userTimezone)}</strong>.
                </span>
              </div>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={feed.isRefreshing}
                className="shrink-0 font-semibold underline hover:opacity-80"
              >
                Retry now
              </button>
            </div>
          )}

          {!savedView && partialProviderDegraded && meta && meta.freshness !== "stale" && (
            <div
              role="status"
              data-testid="news-partial-banner"
              className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-[11px] text-[var(--color-text-secondary)]"
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[var(--color-warning)]" aria-hidden />
              <span>
                One secondary upstream source was rate-limited or unavailable; displaying verified stories from active feeds (
                {meta.active_providers.join(", ")}).
              </span>
            </div>
          )}

          {/* Initial Loading State */}
          {!savedView && feed.isLoading && (
            <div className="space-y-3" data-testid="news-loading-skeleton" role="status" aria-label="Loading market news">
              <Skeleton className="h-44 w-full rounded-xl" />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-36 w-full rounded-xl" />
                ))}
              </div>
            </div>
          )}

          {/* API Error State (when no cached data is available) */}
          {!savedView && !feed.isLoading && feed.error && !feed.data && (
            <div
              role="alert"
              data-testid="news-error-state"
              className="dash-card flex flex-col items-center justify-center px-6 py-12 text-center"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]">
                <AlertCircle className="h-5 w-5" aria-hidden />
              </div>
              <h2 className="mt-3 text-[15px] font-semibold text-[var(--color-text-primary)]">
                Unable to load market news
              </h2>
              <p className="mt-1 max-w-md text-[12px] text-[var(--color-text-secondary)]">
                {feed.error instanceof ApiError
                  ? feed.error.message
                  : "We could not reach the upstream financial news providers. Please check your connection and try again."}
              </p>
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => feed.refetch()}
                  className="dash-btn-primary h-8 px-4 text-[12px]"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Saved View Empty State */}
          {savedView && !bookmarksQuery.isLoading && displayedArticles.length === 0 && (
            <div
              data-testid="news-saved-empty"
              className="dash-card flex flex-col items-center justify-center px-6 py-12 text-center"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)]">
                <Bookmark className="h-5 w-5" aria-hidden />
              </div>
              <h2 className="mt-3 text-[15px] font-semibold text-[var(--color-text-primary)]">
                No saved stories yet
              </h2>
              <p className="mt-1 max-w-md text-[12px] text-[var(--color-text-secondary)]">
                Bookmark important macro releases, central-bank commentary, or instrument headlines to review them alongside your trading journal.
              </p>
              <button
                type="button"
                onClick={() => setSavedView(false)}
                className="dash-btn-secondary mt-4 h-8 px-4 text-[12px]"
              >
                Browse market news
              </button>
            </div>
          )}

          {/* Main Feed Empty State */}
          {!savedView && !feed.isLoading && !feed.error && feed.data && !featured && displayedArticles.length === 0 && (
            <div
              data-testid="news-empty-state"
              className="dash-card flex flex-col items-center justify-center px-6 py-12 text-center"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)]">
                <Newspaper className="h-5 w-5" aria-hidden />
              </div>
              <h2 className="mt-3 text-[15px] font-semibold text-[var(--color-text-primary)]">
                No matching financial news found
              </h2>
              <p className="mt-1 max-w-md text-[12px] text-[var(--color-text-secondary)]">
                No stories in the current pool matched your active category, symbol, or search filters.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {hasActiveRefinements(filters) && (
                  <button
                    type="button"
                    onClick={clearRefinements}
                    className="dash-btn-primary h-8 px-3.5 text-[12px]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                    Clear filters
                  </button>
                )}
                {filters.category !== "all" && (
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="dash-btn-secondary h-8 px-3.5 text-[12px]"
                  >
                    Switch to All News
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Featured Story */}
          {!savedView && featured && (
            <FeaturedStoryCard
              article={featured}
              timezone={userTimezone}
              isBookmarkPending={toggleBookmark.isPending}
              onToggleBookmark={handleToggleBookmark}
              onSelectSymbol={handleSelectSymbol}
            />
          )}

          {/* Article Grid */}
          {displayedArticles.length > 0 && (
            <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-2" data-testid="news-articles-grid">
              {displayedArticles.map((article) => (
                <NewsArticleCard
                  key={article.id}
                  article={article}
                  timezone={userTimezone}
                  isBookmarkPending={toggleBookmark.isPending}
                  onToggleBookmark={handleToggleBookmark}
                  onSelectSymbol={handleSelectSymbol}
                />
              ))}
            </div>
          )}

          {/* Pagination & Attribution Footer */}
          {!savedView && feed.data && (featured || displayedArticles.length > 0) && (
            <div className="mt-1 flex flex-col items-center justify-between gap-3 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-4 py-3 sm:flex-row">
              <p className="text-[11px] text-[var(--color-text-tertiary)]">
                Headlines and excerpts are provided for market context and link directly to original publishers. Sentiment and tags are informational, not trading advice.
              </p>

              <div className="flex shrink-0 items-center gap-2">
                {meta?.has_more ? (
                  <button
                    type="button"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={feed.isFetching}
                    data-testid="news-load-more"
                    className="dash-btn-secondary h-8 px-4 text-[12px]"
                  >
                    {feed.isFetching ? "Loading more…" : "Load more stories"}
                  </button>
                ) : (
                  <span
                    className="text-[11px] font-medium text-[var(--color-text-muted)]"
                    data-testid="news-end-of-results"
                  >
                    End of results ({meta?.candidate_count ?? displayedArticles.length} total)
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
