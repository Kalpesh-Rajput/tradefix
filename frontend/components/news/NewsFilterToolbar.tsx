"use client";

import { ArrowUpDown, Calendar, Filter, RotateCcw, Search, X } from "lucide-react";
import { useEffect, useState } from "react";

import { hasActiveRefinements } from "@/lib/news/format";
import type { NewsDateRange, NewsFilterState, NewsSentiment, NewsSort } from "@/lib/news/types";

interface NewsFilterToolbarProps {
  filters: NewsFilterState;
  availableSources: string[];
  sentimentAvailable: boolean;
  totalMatched: number;
  onUpdateFilters: (patch: Partial<NewsFilterState>) => void;
  onClearFilters: () => void;
}

export function NewsFilterToolbar({
  filters,
  availableSources,
  sentimentAvailable,
  totalMatched,
  onUpdateFilters,
  onClearFilters,
}: NewsFilterToolbarProps) {
  const [searchDraft, setSearchDraft] = useState(filters.query);

  useEffect(() => {
    setSearchDraft(filters.query);
  }, [filters.query]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchDraft.trim() !== filters.query.trim()) {
        onUpdateFilters({ query: searchDraft.trim() });
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchDraft, filters.query, onUpdateFilters]);

  const activeRefinements = hasActiveRefinements(filters);

  return (
    <div className="dash-card flex flex-wrap items-center justify-between gap-2.5 p-3">
      <div className="relative min-w-[200px] flex-1 sm:max-w-sm">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-tertiary)]"
          aria-hidden
        />
        <input
          type="search"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          placeholder="Search headlines, central banks, symbols…"
          aria-label="Search financial news headlines"
          data-testid="news-search-input"
          className="h-8 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] pl-8 pr-7 text-[12px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-primary/50 focus:outline-none"
        />
        {searchDraft && (
          <button
            type="button"
            onClick={() => {
              setSearchDraft("");
              onUpdateFilters({ query: "" });
            }}
            aria-label="Clear search query"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-text-secondary)]">
          <Calendar className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" aria-hidden />
          <span className="sr-only">Date range</span>
          <select
            value={filters.dateRange}
            onChange={(e) => onUpdateFilters({ dateRange: e.target.value as NewsDateRange })}
            data-testid="news-filter-daterange"
            aria-label="Filter by publication window"
            className="dash-control h-8 cursor-pointer pr-6 text-[11px] font-medium"
          >
            <option value="all">All recent</option>
            <option value="24h">Past 24 hours</option>
            <option value="7d">Past 7 days</option>
            <option value="30d">Past 30 days</option>
          </select>
        </label>

        {availableSources.length > 0 && (
          <label className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-text-secondary)]">
            <Filter className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" aria-hidden />
            <span className="sr-only">Publisher source</span>
            <select
              value={filters.source}
              onChange={(e) => onUpdateFilters({ source: e.target.value })}
              data-testid="news-filter-source"
              aria-label="Filter by publisher source"
              className="dash-control h-8 max-w-[160px] cursor-pointer truncate pr-6 text-[11px] font-medium"
            >
              <option value="">All publishers</option>
              {availableSources.map((src) => (
                <option key={src} value={src}>
                  {src}
                </option>
              ))}
            </select>
          </label>
        )}

        {sentimentAvailable && (
          <label className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-text-secondary)]">
            <span className="sr-only">Sentiment</span>
            <select
              value={filters.sentiment}
              onChange={(e) => onUpdateFilters({ sentiment: e.target.value as "" | NewsSentiment })}
              data-testid="news-filter-sentiment"
              aria-label="Filter by provider sentiment"
              className="dash-control h-8 cursor-pointer pr-6 text-[11px] font-medium"
            >
              <option value="">All sentiment</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>
          </label>
        )}

        <label className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-text-secondary)]">
          <ArrowUpDown className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" aria-hidden />
          <span className="sr-only">Sort order</span>
          <select
            value={filters.sort}
            onChange={(e) => onUpdateFilters({ sort: e.target.value as NewsSort })}
            data-testid="news-filter-sort"
            aria-label="Sort articles"
            className="dash-control h-8 cursor-pointer pr-6 text-[11px] font-medium"
          >
            <option value="newest">Newest first</option>
            <option value="relevance">Relevance</option>
          </select>
        </label>

        {activeRefinements && (
          <button
            type="button"
            onClick={() => {
              setSearchDraft("");
              onClearFilters();
            }}
            data-testid="news-clear-filters"
            className="dash-btn-secondary h-8 px-2.5 text-[11px]"
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
            Clear filters
          </button>
        )}

        <span
          className="ml-1 hidden text-[11px] tabular-nums text-[var(--color-text-tertiary)] xl:inline"
          data-testid="news-pool-count"
        >
          {totalMatched} {totalMatched === 1 ? "story" : "stories"} in pool
        </span>
      </div>
    </div>
  );
}
