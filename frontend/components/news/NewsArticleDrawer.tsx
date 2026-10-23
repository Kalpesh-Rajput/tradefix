"use client";

import clsx from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Bookmark,
  BookmarkCheck,
  Building2,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  FileText,
  Globe,
  Layers,
  Tag,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useToast } from "@/components/ui/Toast";
import {
  categoryLabel,
  formatNewsExactTimestamp,
  formatNewsRelativeTime,
  isSafeExternalUrl,
} from "@/lib/news/format";
import type { NewsArticle } from "@/lib/news/types";

interface NewsArticleDrawerProps {
  article: NewsArticle | null;
  articles: NewsArticle[];
  timezone?: string;
  isBookmarkPending?: boolean;
  onClose: () => void;
  onSelectArticle: (article: NewsArticle) => void;
  onToggleBookmark: (article: NewsArticle) => void;
  onSelectSymbol: (symbol: string) => void;
}

function providerDisplayName(provider: string): string {
  switch (provider) {
    case "marketaux":
      return "Marketaux Financial Wire";
    case "gdelt":
      return "GDELT DOC 2.0 Global Wire";
    case "google_rss":
      return "Google News Financial RSS";
    default:
      return provider;
  }
}

export function NewsArticleDrawer({
  article,
  articles,
  timezone,
  isBookmarkPending,
  onClose,
  onSelectArticle,
  onToggleBookmark,
  onSelectSymbol,
}: NewsArticleDrawerProps) {
  const reduce = useReducedMotion();
  const { success: toastSuccess } = useToast();
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentIndex = useMemo(() => {
    if (!article) return -1;
    return articles.findIndex((a) => a.id === article.id);
  }, [article, articles]);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < articles.length - 1;

  const relatedArticles = useMemo(() => {
    if (!article) return [];
    const currentSymbols = new Set(article.symbols.map((s) => s.toUpperCase()));
    return articles
      .filter((candidate) => candidate.id !== article.id)
      .map((candidate) => {
        const sharedSymbols = candidate.symbols.filter((s) =>
          currentSymbols.has(s.toUpperCase())
        ).length;
        const sameCategory = candidate.category === article.category ? 1 : 0;
        return { candidate, score: sharedSymbols * 3 + sameCategory };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((item) => item.candidate);
  }, [article, articles]);

  useEffect(() => {
    if (!article) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const prevFocus = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();

    return () => {
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [article]);

  useEffect(() => {
    setCopied(false);
  }, [article?.id]);

  useEffect(() => {
    if (!article) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowLeft" && hasPrev) {
        e.preventDefault();
        onSelectArticle(articles[currentIndex - 1]);
        return;
      }
      if (e.key === "ArrowRight" && hasNext) {
        e.preventDefault();
        onSelectArticle(articles[currentIndex + 1]);
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [article, articles, currentIndex, hasNext, hasPrev, onClose, onSelectArticle]);

  if (!mounted) return null;

  const safeHref = article && isSafeExternalUrl(article.url) ? article.url : undefined;
  const relTime = article ? formatNewsRelativeTime(article.published_at) : "";
  const exactLocal = article ? formatNewsExactTimestamp(article.published_at, timezone) : "";
  const exactUtc = article ? formatNewsExactTimestamp(article.published_at, "UTC") : "";

  async function handleCopyLink() {
    if (!safeHref) return;
    try {
      await navigator.clipboard.writeText(safeHref);
      setCopied(true);
      toastSuccess("Article link copied to clipboard");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  }

  return createPortal(
    <AnimatePresence>
      {article && (
        <div
          className="fixed inset-0 z-[70] flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-labelledby="news-drawer-title"
          data-testid="news-article-drawer"
        >
          {/* Scrim — use rgb alpha (not bg-black/40) so light-mode overrides do not wash the feed white */}
          <motion.button
            type="button"
            aria-label="Close news preview panel"
            data-testid="news-drawer-backdrop"
            className="absolute inset-0 bg-[rgb(16_14_28_/0.28)]"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />

          {/* Right-hand slide-over panel */}
          <motion.aside
            ref={panelRef}
            initial={reduce ? false : { x: "100%", opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { x: "100%", opacity: 0.6 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex h-full w-full flex-col overflow-hidden border-l border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[var(--shadow-dropdown)] sm:w-[min(88vw,540px)]"
          >
            {/* Top bar */}
            <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3 sm:px-5">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={!hasPrev}
                  onClick={() => hasPrev && onSelectArticle(articles[currentIndex - 1])}
                  aria-label="Previous story"
                  title="Previous story (Left arrow)"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  disabled={!hasNext}
                  onClick={() => hasNext && onSelectArticle(articles[currentIndex + 1])}
                  aria-label="Next story"
                  title="Next story (Right arrow)"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
                {currentIndex >= 0 && (
                  <span className="ml-1.5 text-[11px] font-medium tabular-nums text-[var(--color-text-tertiary)]">
                    Story {currentIndex + 1} of {articles.length}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {safeHref && (
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    aria-label="Copy article URL"
                    title="Copy article link"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[11px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-[var(--color-success-text)]" aria-hidden />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" aria-hidden />
                        <span>Copy link</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onToggleBookmark(article)}
                  disabled={isBookmarkPending}
                  aria-label={article.is_bookmarked ? "Remove bookmark" : "Bookmark story"}
                  data-testid="news-drawer-bookmark-btn"
                  className={clsx(
                    "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium transition-colors",
                    article.is_bookmarked
                      ? "border-primary/40 bg-[var(--color-primary-light)] text-[var(--color-primary)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-primary/30 hover:text-[var(--color-text-primary)]"
                  )}
                >
                  {article.is_bookmarked ? (
                    <>
                      <BookmarkCheck className="h-3.5 w-3.5" aria-hidden />
                      <span>Saved</span>
                    </>
                  ) : (
                    <>
                      <Bookmark className="h-3.5 w-3.5" aria-hidden />
                      <span>Save</span>
                    </>
                  )}
                </button>

                <button
                  ref={closeBtnRef}
                  type="button"
                  onClick={onClose}
                  aria-label="Close panel"
                  data-testid="news-drawer-close"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </header>

            {/* Scrollable content */}
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
              {/* Category, publisher & sentiment badges */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-primary-light)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-primary)]">
                  {categoryLabel(article.category)}
                </span>
                <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--color-text-primary)]">
                  <Building2 className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" aria-hidden />
                  {article.source}
                </span>
                <span className="text-[var(--color-text-muted)]" aria-hidden>
                  ·
                </span>
                <time
                  dateTime={article.published_at}
                  className="text-[12px] text-[var(--color-text-tertiary)]"
                >
                  {relTime}
                </time>
                {article.sentiment && (
                  <span
                    className={clsx(
                      "rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize",
                      article.sentiment === "positive" &&
                        "bg-[var(--color-success-bg)] text-[var(--color-success-text)]",
                      article.sentiment === "negative" &&
                        "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]",
                      article.sentiment === "neutral" &&
                        "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]"
                    )}
                  >
                    {article.sentiment} sentiment
                  </span>
                )}
              </div>

              {/* Headline */}
              <h2
                id="news-drawer-title"
                className="text-[18px] font-semibold leading-snug tracking-tight text-[var(--color-text-primary)] sm:text-[20px]"
              >
                {article.title}
              </h2>

              {/* Article Summary / Digest Box */}
              <section
                aria-label="Article summary"
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-4"
              >
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  <FileText className="h-3.5 w-3.5 text-[var(--color-primary)]" aria-hidden />
                  <span>Story Summary</span>
                </div>
                {article.summary ? (
                  <p
                    className="text-[13.5px] leading-relaxed text-[var(--color-text-primary)]"
                    data-testid="news-drawer-summary"
                  >
                    {article.summary}
                  </p>
                ) : (
                  <div className="space-y-2 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                    <p data-testid="news-drawer-summary">
                      {article.title}
                    </p>
                    <p className="text-[11.5px] text-[var(--color-text-tertiary)]">
                      Published by <strong>{article.source}</strong> under{" "}
                      <strong>{categoryLabel(article.category)}</strong>. Upstream wire provided headline metadata only—use the button below to read the full article on {article.source}.
                    </p>
                  </div>
                )}
              </section>

              {/* Related Market Instruments */}
              {article.symbols.length > 0 && (
                <section aria-label="Related instruments" className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                      <Tag className="h-3.5 w-3.5 text-[var(--color-primary)]" aria-hidden />
                      <span>Related Instruments</span>
                    </span>
                    <span className="text-[11px] text-[var(--color-text-muted)]">
                      Click a symbol to filter feed
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {article.symbols.map((sym) => (
                      <button
                        key={sym}
                        type="button"
                        onClick={() => {
                          onSelectSymbol(sym);
                          onClose();
                        }}
                        className="fx-chip px-3 py-1 text-[12px]"
                      >
                        {sym}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Source & Attribution Metadata Grid */}
              <section aria-label="Source details" className="space-y-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  <Layers className="h-3.5 w-3.5 text-[var(--color-primary)]" aria-hidden />
                  <span>Attribution & Timestamps</span>
                </span>
                <div className="grid grid-cols-1 gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 text-[12px] sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                      Publisher
                    </p>
                    <p className="mt-0.5 font-medium text-[var(--color-text-primary)]">
                      {article.source}
                      {article.source_domain && article.source_domain.toLowerCase() !== article.source.toLowerCase()
                        ? ` (${article.source_domain})`
                        : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                      Category Desk
                    </p>
                    <p className="mt-0.5 font-medium text-[var(--color-text-primary)]">
                      {categoryLabel(article.category)}
                    </p>
                  </div>
                  <div>
                    <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                      <CalendarClock className="h-3 w-3" aria-hidden />
                      Published (Local)
                    </p>
                    <p className="mt-0.5 font-medium tabular-nums text-[var(--color-text-primary)]">
                      {exactLocal}
                    </p>
                  </div>
                  <div>
                    <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                      <Globe className="h-3 w-3" aria-hidden />
                      Published (UTC)
                    </p>
                    <p className="mt-0.5 font-medium tabular-nums text-[var(--color-text-secondary)]">
                      {exactUtc}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                      Upstream Feed Source
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-[var(--color-text-secondary)]">
                      {providerDisplayName(article.provider)}
                    </p>
                  </div>
                </div>
              </section>

              {/* Related Stories in Pool */}
              {relatedArticles.length > 0 && (
                <section aria-label="Related stories" className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    Related Stories in Feed
                  </span>
                  <div className="space-y-2">
                    {relatedArticles.map((rel) => (
                      <button
                        key={rel.id}
                        type="button"
                        onClick={() => onSelectArticle(rel)}
                        className="flex w-full flex-col gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left transition-colors hover:border-primary/40 hover:bg-[var(--color-surface-secondary)]"
                      >
                        <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-tertiary)]">
                          <span className="font-semibold text-[var(--color-text-secondary)]">
                            {rel.source}
                          </span>
                          <span>·</span>
                          <span>{formatNewsRelativeTime(rel.published_at)}</span>
                        </div>
                        <p className="line-clamp-2 text-[12.5px] font-medium text-[var(--color-text-primary)]">
                          {rel.title}
                        </p>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* Sticky Footer with Primary Action to Open in New Tab */}
            <footer className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5 sm:px-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {safeHref ? (
                  <a
                    href={safeHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="news-drawer-open-external"
                    className="dash-btn-primary h-10 flex-1 justify-center px-4 text-[13px] font-semibold"
                  >
                    <span>Open Full Article in New Tab</span>
                    <ExternalLink className="h-4 w-4" aria-hidden />
                  </a>
                ) : (
                  <span className="text-[12px] text-[var(--color-text-muted)]">
                    External article link unavailable
                  </span>
                )}
              </div>
              <p className="mt-2 text-center text-[10.5px] text-[var(--color-text-muted)]">
                Opens original article on <strong>{article.source}</strong> in a new browser tab.
              </p>
            </footer>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
