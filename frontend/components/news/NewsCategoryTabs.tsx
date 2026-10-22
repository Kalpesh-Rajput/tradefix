"use client";

import clsx from "clsx";
import { Bookmark, Sparkles } from "lucide-react";

import { NEWS_CATEGORIES, QUICK_INSTRUMENT_CHIPS, type NewsCategory } from "@/lib/news/types";

interface NewsCategoryTabsProps {
  activeCategory: NewsCategory;
  activeSymbol: string;
  watchlistSymbols: string[];
  savedView: boolean;
  savedCount: number;
  onSelectCategory: (category: NewsCategory) => void;
  onSelectSymbol: (symbol: string) => void;
  onToggleSavedView: (showSaved: boolean) => void;
}

export function NewsCategoryTabs({
  activeCategory,
  activeSymbol,
  watchlistSymbols,
  savedView,
  savedCount,
  onSelectCategory,
  onSelectSymbol,
  onToggleSavedView,
}: NewsCategoryTabsProps) {
  const symbolChips = Array.from(new Set([...watchlistSymbols, ...QUICK_INSTRUMENT_CHIPS])).slice(0, 12);

  return (
    <div className="dash-card flex flex-col gap-2.5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto pb-0.5"
          role="tablist"
          aria-label="News categories"
        >
          {NEWS_CATEGORIES.map((cat) => {
            const selected = !savedView && activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={selected}
                data-testid={`news-cat-${cat.id}`}
                onClick={() => {
                  if (savedView) onToggleSavedView(false);
                  onSelectCategory(cat.id);
                }}
                className={clsx(
                  "inline-flex h-8 shrink-0 items-center rounded-lg px-3 text-[12px] font-medium transition-colors",
                  selected
                    ? "bg-primary text-primary-foreground text-on-accent shadow-sm"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)]"
                )}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          data-testid="news-saved-tab"
          onClick={() => onToggleSavedView(!savedView)}
          aria-pressed={savedView}
          className={clsx(
            "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[12px] font-medium transition-colors",
            savedView
              ? "border-primary bg-primary text-primary-foreground text-on-accent"
              : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-primary/40 hover:text-[var(--color-text-primary)]"
          )}
        >
          <Bookmark className="h-3.5 w-3.5" aria-hidden />
          <span>Saved</span>
          <span
            className={clsx(
              "ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-semibold tabular-nums",
              savedView ? "bg-white/20 text-white" : "bg-[var(--color-primary-light)] text-[var(--color-primary)]"
            )}
          >
            {savedCount}
          </span>
        </button>
      </div>

      {!savedView && (
        <div className="flex items-center gap-1.5 overflow-x-auto border-t border-[var(--color-border-subtle)] pt-2">
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-[var(--color-text-tertiary)]">
            <Sparkles className="h-3 w-3 text-[var(--color-primary)]" aria-hidden />
            {watchlistSymbols.length > 0 ? "Watchlist & desks:" : "Instruments:"}
          </span>
          {symbolChips.map((sym) => {
            const isSelected = activeSymbol.toUpperCase() === sym.toUpperCase();
            const isWatchlist = watchlistSymbols.some((w) => w.toUpperCase() === sym.toUpperCase());
            return (
              <button
                key={sym}
                type="button"
                data-testid={`news-symbol-chip-${sym}`}
                onClick={() => onSelectSymbol(isSelected ? "" : sym)}
                aria-pressed={isSelected}
                className={clsx(
                  "fx-chip shrink-0",
                  isSelected && "is-active",
                  isWatchlist && !isSelected && "border-primary/25"
                )}
              >
                {sym}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
