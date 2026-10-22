"use client";

import clsx from "clsx";
import { Bookmark, BookmarkCheck, Clock, ExternalLink } from "lucide-react";
import { useState } from "react";

import {
  categoryLabel,
  formatNewsExactTimestamp,
  formatNewsRelativeTime,
  isSafeExternalUrl,
} from "@/lib/news/format";
import type { NewsArticle } from "@/lib/news/types";

interface NewsArticleCardProps {
  article: NewsArticle;
  timezone?: string;
  isBookmarkPending?: boolean;
  onToggleBookmark: (article: NewsArticle) => void;
  onSelectSymbol: (symbol: string) => void;
}

export function NewsArticleCard({
  article,
  timezone,
  isBookmarkPending,
  onToggleBookmark,
  onSelectSymbol,
}: NewsArticleCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const safeHref = isSafeExternalUrl(article.url) ? article.url : undefined;
  const safeImg = !imgFailed && isSafeExternalUrl(article.image_url) ? article.image_url : undefined;
  const relTime = formatNewsRelativeTime(article.published_at);
  const exactTime = formatNewsExactTimestamp(article.published_at, timezone);

  return (
    <article
      className="dash-card ms-card-hover flex h-full flex-col justify-between p-4"
      data-testid="news-article-card"
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px]">
            <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-2 py-0.5 font-medium text-[var(--color-text-secondary)]">
              {categoryLabel(article.category)}
            </span>
            <span className="truncate font-semibold text-[var(--color-text-primary)]">
              {article.source}
            </span>
            <span className="text-[var(--color-text-muted)]" aria-hidden>
              ·
            </span>
            <time
              dateTime={article.published_at}
              title={`Published: ${exactTime}`}
              className="inline-flex shrink-0 items-center gap-1 text-[var(--color-text-tertiary)]"
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
            onClick={() => onToggleBookmark(article)}
            disabled={isBookmarkPending}
            aria-label={article.is_bookmarked ? "Remove bookmark" : "Bookmark article"}
            data-testid={`news-bookmark-btn-${article.id}`}
            className={clsx(
              "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors",
              article.is_bookmarked
                ? "border-primary/40 bg-[var(--color-primary-light)] text-[var(--color-primary)]"
                : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-tertiary)] hover:border-primary/30 hover:text-[var(--color-text-primary)]"
            )}
          >
            {article.is_bookmarked ? (
              <BookmarkCheck className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Bookmark className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
        </div>

        <div className="mt-2.5 flex gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-[14px] font-semibold leading-snug text-[var(--color-text-primary)]">
              {safeHref ? (
                <a
                  href={safeHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-[var(--color-primary)]"
                >
                  {article.title}
                </a>
              ) : (
                article.title
              )}
            </h3>

            {article.summary && (
              <p className="mt-1.5 line-clamp-3 text-[12px] leading-relaxed text-[var(--color-text-secondary)]">
                {article.summary}
              </p>
            )}
          </div>

          {safeImg && (
            <img
              src={safeImg}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="h-16 w-24 shrink-0 rounded-lg border border-[var(--color-border)] object-cover"
            />
          )}
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border-subtle)] pt-2.5">
        <div className="flex flex-wrap items-center gap-1">
          {article.symbols.length > 0 ? (
            article.symbols.slice(0, 4).map((sym) => (
              <button
                key={sym}
                type="button"
                onClick={() => onSelectSymbol(sym)}
                className="fx-chip px-2 py-0.5 text-[10px]"
                title={`Filter news by ${sym}`}
              >
                {sym}
              </button>
            ))
          ) : (
            <span className="text-[11px] text-[var(--color-text-muted)]" title={exactTime}>
              {exactTime}
            </span>
          )}
        </div>

        {safeHref && (
          <a
            href={safeHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open article on ${article.source} in new tab`}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-primary)] transition-opacity hover:opacity-80"
          >
            <span>Open source</span>
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        )}
      </div>
    </article>
  );
}
