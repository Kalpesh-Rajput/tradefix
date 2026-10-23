"use client";

import clsx from "clsx";
import { Bookmark, BookmarkCheck, Clock, ExternalLink, PanelRightOpen, Sparkles } from "lucide-react";

import {
  categoryLabel,
  formatNewsExactTimestamp,
  formatNewsRelativeTime,
  isSafeExternalUrl,
} from "@/lib/news/format";
import type { NewsArticle } from "@/lib/news/types";

interface FeaturedStoryCardProps {
  article: NewsArticle;
  timezone?: string;
  isSelected?: boolean;
  isBookmarkPending?: boolean;
  onSelectArticle: (article: NewsArticle) => void;
  onToggleBookmark: (article: NewsArticle) => void;
  onSelectSymbol: (symbol: string) => void;
}

export function FeaturedStoryCard({
  article,
  timezone,
  isSelected,
  isBookmarkPending,
  onSelectArticle,
  onToggleBookmark,
  onSelectSymbol,
}: FeaturedStoryCardProps) {
  const safeHref = isSafeExternalUrl(article.url) ? article.url : undefined;
  const relTime = formatNewsRelativeTime(article.published_at);
  const exactTime = formatNewsExactTimestamp(article.published_at, timezone);

  return (
    <article
      onClick={() => onSelectArticle(article)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelectArticle(article);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`View summary for featured story: ${article.title}`}
      className={clsx(
        "dash-card tf-hero-card group relative cursor-pointer overflow-hidden p-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 sm:p-5",
        isSelected && "border-primary/60 ring-1 ring-primary/30"
      )}
      data-testid="news-featured-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary-light)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-primary)]">
            <Sparkles className="h-3 w-3" aria-hidden />
            Featured Story
          </span>
          <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
            {categoryLabel(article.category)}
          </span>
          <span className="text-[12px] font-semibold text-[var(--color-text-primary)]">
            {article.source}
          </span>
          <span className="text-[var(--color-text-muted)]" aria-hidden>
            ·
          </span>
          <time
            dateTime={article.published_at}
            title={`Published: ${exactTime}`}
            className="inline-flex items-center gap-1 text-[11px] text-[var(--color-text-tertiary)]"
          >
            <Clock className="h-3 w-3" aria-hidden />
            {relTime}
          </time>
          {article.sentiment && (
            <span
              className={clsx(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                article.sentiment === "positive" &&
                  "bg-[var(--color-success-bg)] text-[var(--color-success-text)]",
                article.sentiment === "negative" &&
                  "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]",
                article.sentiment === "neutral" &&
                  "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]"
              )}
            >
              {article.sentiment}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleBookmark(article);
          }}
          disabled={isBookmarkPending}
          aria-label={article.is_bookmarked ? "Remove from saved stories" : "Save story"}
          data-testid="news-featured-bookmark"
          className={clsx(
            "inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors",
            article.is_bookmarked
              ? "border-primary/40 bg-[var(--color-primary-light)] text-[var(--color-primary)]"
              : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-tertiary)] hover:border-primary/30 hover:text-[var(--color-text-primary)]"
          )}
        >
          {article.is_bookmarked ? (
            <BookmarkCheck className="h-4 w-4" aria-hidden />
          ) : (
            <Bookmark className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>

      <h2 className="mt-2.5 text-[17px] font-semibold leading-snug tracking-tight text-[var(--color-text-primary)] transition-colors group-hover:text-[var(--color-primary)] sm:text-[19px]">
        {article.title}
      </h2>

      {article.summary && (
        <p className="mt-2 max-w-4xl text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
          {article.summary}
        </p>
      )}

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border-subtle)] pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {article.symbols.length > 0 ? (
            article.symbols.map((sym) => (
              <button
                key={sym}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectSymbol(sym);
                }}
                className="fx-chip text-[11px]"
                title={`Filter news by ${sym}`}
              >
                {sym}
              </button>
            ))
          ) : (
            <span className="text-[11px] text-[var(--color-text-muted)]">
              Published {exactTime}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectArticle(article);
            }}
            data-testid="news-featured-summary-btn"
            className="dash-btn-secondary h-8 px-3 text-[12px]"
          >
            <PanelRightOpen className="h-3.5 w-3.5" aria-hidden />
            <span>View Summary</span>
          </button>

          {safeHref && (
            <a
              href={safeHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              data-testid="news-featured-read-link"
              className="dash-btn-primary h-8 px-3 text-[12px]"
            >
              <span>Open in New Tab</span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
